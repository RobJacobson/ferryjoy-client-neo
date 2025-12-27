import { api } from "_generated/api";
import { type ActionCtx, internalAction } from "_generated/server";
import { calculateInitialPredictions, updateEtaOnDeparture } from "domain/ml";
import {
  type ConvexVesselLocation,
  toConvexVesselLocation,
} from "functions/vesselLocation/schemas";
import {
  type ConvexVesselTrip,
  toConvexVesselTrip,
} from "functions/vesselTrips/schemas";
import { convertConvexVesselLocation } from "shared/convertVesselLocations";
import {
  calculateAtDockDuration,
  calculateAtSeaDuration,
  calculateTotalDuration,
} from "shared/durationUtils";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";
import { fetchVesselLocations } from "ws-dottie/wsf-vessels/core";

/**
 * Updates active vessel trips based on current vessel locations.
 *
 * This action synchronizes the active vessel trips with the latest vessel location data
 * from the WSF API. It handles two main scenarios:
 *
 * 1. **New trip detection**: When no existing trip exists (first time seeing a vessel) or when
 *    the departing terminal changes, the existing trip (if any) is completed and saved to the
 *    completed trips collection, and a new active trip is created.
 *
 * 2. **Trip updates**: When an existing trip needs data updates due to changes in:
 *    - `AtDock` status (e.g., vessel leaves the dock)
 *    - `Eta` (estimated arrival time)
 *    - `ArrivingTerminalAbbrev` (destination terminal)
 *    - `LeftDock` (actual departure time)
 *
 * @returns A Promise that resolves when all vessel trips have been processed.
 */
export const updateVesselTrips = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Get the current active trips
    const existingTripsList = (
      await ctx.runQuery(api.functions.vesselTrips.queries.getActiveTrips)
    ).map(({ _id, _creationTime, ...rest }) => rest as ConvexVesselTrip);

    // 2. Create a dictionary of existing trips by VesselAbbrev
    const existingTripsDict = Object.fromEntries(
      existingTripsList.map((trip) => [trip.VesselAbbrev, trip])
    ) as Record<string, ConvexVesselTrip>;

    // 3. Get a list of current locations
    const vesselLocations = (
      (await fetchVesselLocations()) as unknown as DottieVesselLocation[]
    )
      .map(toConvexVesselLocation)
      .map(convertConvexVesselLocation);

    // 4. Process each vessel location
    for (const currLocation of vesselLocations) {
      const existingTrip = existingTripsDict[currLocation.VesselAbbrev];

      // Case (a): New trip - either no existing trip or departing terminal changed
      if (await checkAndHandleNewTrip(ctx, existingTrip, currLocation)) {
        continue;
      }
      // Case (b): Update trip - existing trip needs data updates
      if (existingTrip) {
        await checkAndHandleTripUpdate(ctx, currLocation, existingTrip);
      }
    }
  },
});

/**
 * Checks if a new trip is needed and handles the transition.
 *
 * A new trip is detected when either:
 * - No existing trip exists (first time seeing this vessel)
 * - The departing terminal has changed (indicating a new route has started)
 *
 * When a new trip is needed:
 * - If an existing trip exists, it is completed with a `TripEnd` timestamp and saved
 *   to the `completedVesselTrips` collection
 * - A new active trip is created and inserted into the `activeVesselTrips` collection
 *
 * @param ctx - The Convex action context for running mutations
 * @param existingTrip - The existing active trip for this vessel, or undefined if none exists
 * @param currLocation - The current vessel location data from WSF API
 * @returns `true` if a new trip was handled, `false` if no new trip action was needed
 */
const checkAndHandleNewTrip = async (
  ctx: ActionCtx,
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
) => {
  if (
    existingTrip &&
    existingTrip.DepartingTerminalAbbrev ===
      currLocation.DepartingTerminalAbbrev
  ) {
    return false;
  }

  if (existingTrip) {
    // Complete existing trip and start new one
    // Calculate AtSeaDuration and TotalDuration when completing the trip
    const atSeaDuration = calculateAtSeaDuration(
      existingTrip.LeftDock,
      currLocation.TimeStamp
    );
    const totalDuration = calculateTotalDuration(
      existingTrip.TripStart,
      currLocation.TimeStamp
    );

    const completedTrip: ConvexVesselTrip = {
      ...existingTrip,
      TripEnd: currLocation.TimeStamp,
      AtSeaDuration: atSeaDuration,
      TotalDuration: totalDuration,
    };

    const newTrip = toConvexVesselTrip(currLocation, {
      TripStart: currLocation.TimeStamp,
    });

    // Atomic operation: complete existing, start new
    await ctx.runMutation(
      api.functions.vesselTrips.mutations.completeAndStartNewTrip,
      {
        completedTrip,
        newTrip,
      }
    );
  } else {
    const delay = calculateDelay(
      currLocation.ScheduledDeparture,
      currLocation.LeftDock
    );

    const newTrip = toConvexVesselTrip(currLocation, {
      Delay: delay,
    });
    await ctx.runMutation(
      api.functions.vesselTrips.mutations.upsertActiveTrip,
      { trip: newTrip }
    );
  }

  return true;
};

/**
 * Checks if trip data needs updating and applies updates to the active trip.
 *
 * This function compares the current vessel location data with the existing active trip
 * and updates the trip if any of the following fields have changed:
 *
 * - `AtDock`: Indicates whether the vessel is currently docked
 * - `Eta`: Estimated arrival time at the destination terminal
 * - `ArrivingTerminalAbbrev`: The destination terminal abbreviation
 * - `LeftDock`: Actual time when the vessel departed from the dock
 *
 * When updates are needed, the `Delay` field is recalculated based on the scheduled
 * departure time and actual `LeftDock` time. All updated fields are then persisted
 * to the database.
 *
 * Special handling for predictions:
 * - When `ArrivingTerminalAbbrev` transitions from `null` to a value (first time we
 *   know the destination), the `calculateInitialPredictions` function is called to
 *   generate initial LeftDockPred and EtaPred predictions.
 * - When `LeftDock` transitions from `undefined` to a value (vessel leaves dock),
 *   the `updateEtaOnDeparture` function is called to generate a more accurate ETA
 *   prediction based on the actual at-dock duration.
 * - All prediction results (LeftDockPred, LeftDockPredMae, EtaPred, EtaPredMae) are
 *   merged into the updated trip data.
 *
 * If no changes are detected, the function returns early without performing any database
 * operations.
 *
 * @param ctx - The Convex action context for running mutations
 * @param currLocation - The current vessel location data from WSF API
 * @param existingTrip - The existing active trip for this vessel
 */
const checkAndHandleTripUpdate = async (
  ctx: ActionCtx,
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip
) => {
  const updates = calculateTripUpdates(currLocation, existingTrip);

  if (!hasTripChanges(updates)) {
    return;
  }

  const initialPredictions = await calculateInitialPredictionsIfNeeded(
    ctx,
    currLocation,
    existingTrip,
    updates
  );

  const etaPrediction = await updateEtaOnDepartureIfNeeded(
    ctx,
    currLocation,
    existingTrip,
    updates
  );

  const updatedTrip = buildUpdatedTrip(
    currLocation,
    existingTrip,
    updates,
    initialPredictions,
    etaPrediction
  );

  await ctx.runMutation(api.functions.vesselTrips.mutations.upsertActiveTrip, {
    trip: updatedTrip,
  });
};

/**
 * Calculates derived values and detects changes between current location and existing trip.
 */
const calculateTripUpdates = (
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip
) => {
  const atDockDuration =
    currLocation.LeftDock && existingTrip.TripStart
      ? calculateAtDockDuration(existingTrip.TripStart, currLocation.LeftDock)
      : undefined;

  const delay = calculateDelay(
    currLocation.ScheduledDeparture,
    currLocation.LeftDock
  );

  const arrivingTerminalBecameAvailable =
    existingTrip.ArrivingTerminalAbbrev === null &&
    currLocation.ArrivingTerminalAbbrev !== null;

  return {
    atDockDuration,
    delay,
    atDockChanged: existingTrip.AtDock !== currLocation.AtDock,
    etaChanged: existingTrip.Eta !== currLocation.Eta,
    arrivingTerminalChanged:
      existingTrip.ArrivingTerminalAbbrev !==
      currLocation.ArrivingTerminalAbbrev,
    arrivingTerminalBecameAvailable,
    leftDockChanged: existingTrip.LeftDock !== currLocation.LeftDock,
    atDockDurationChanged: atDockDuration !== existingTrip.AtDockDuration,
    delayChanged: delay !== existingTrip.Delay,
  };
};

/**
 * Determines if any trip fields have changed.
 */
const hasTripChanges = (
  updates: ReturnType<typeof calculateTripUpdates>
): boolean => {
  return (
    updates.atDockChanged ||
    updates.etaChanged ||
    updates.arrivingTerminalChanged ||
    updates.arrivingTerminalBecameAvailable ||
    updates.leftDockChanged ||
    updates.atDockDurationChanged ||
    updates.delayChanged
  );
};

/**
 * Updates ETA prediction when vessel leaves dock, handling errors gracefully.
 */
const updateEtaOnDepartureIfNeeded = async (
  ctx: ActionCtx,
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip,
  updates: ReturnType<typeof calculateTripUpdates>
): Promise<{
  EtaPred?: number;
  EtaPredMae?: number;
}> => {
  const vesselDeparted =
    updates.leftDockChanged &&
    !existingTrip.LeftDock &&
    !!currLocation.LeftDock &&
    !!updates.atDockDuration;

  if (!vesselDeparted) {
    return {};
  }

  try {
    const etaResult = await updateEtaOnDeparture(
      ctx,
      existingTrip,
      currLocation
    );

    if (etaResult.predictedTime) {
      logEtaPredictionSuccess(existingTrip, currLocation, updates, etaResult);
      return {
        EtaPred: etaResult.predictedTime,
        EtaPredMae: etaResult.mae,
      };
    }

    logEtaPredictionSkipped(existingTrip, etaResult);
    return {};
  } catch (error) {
    logEtaPredictionError(existingTrip, error);
    return {};
  }
};

/**
 * Logs successful ETA prediction update.
 */
const logEtaPredictionSuccess = (
  existingTrip: ConvexVesselTrip,
  currLocation: ConvexVesselLocation,
  updates: ReturnType<typeof calculateTripUpdates>,
  etaResult: Awaited<ReturnType<typeof updateEtaOnDeparture>>
): void => {
  console.log(
    `[ML Prediction] EtaPred updated on departure for ${existingTrip.VesselAbbrev}:`,
    {
      vessel: existingTrip.VesselAbbrev,
      departingTerminal: existingTrip.DepartingTerminalAbbrev,
      arrivingTerminal: existingTrip.ArrivingTerminalAbbrev,
      leftDock: currLocation.LeftDock,
      atDockDuration: updates.atDockDuration,
      delay: updates.delay,
      predictedEta: etaResult.predictedTime,
      etaMae: etaResult.mae,
    }
  );
};

/**
 * Logs skipped ETA prediction update.
 */
const logEtaPredictionSkipped = (
  existingTrip: ConvexVesselTrip,
  etaResult: Awaited<ReturnType<typeof updateEtaOnDeparture>>
): void => {
  console.log(
    `[ML Prediction] EtaPred update skipped for ${existingTrip.VesselAbbrev}`,
    {
      vessel: existingTrip.VesselAbbrev,
      reason: etaResult.skipReason || "Insufficient data or model not found",
    }
  );
};

/**
 * Logs ETA prediction error.
 */
const logEtaPredictionError = (
  existingTrip: ConvexVesselTrip,
  error: unknown
): void => {
  console.error(
    `[ML Prediction] Failed to update EtaPred on departure for ${existingTrip.VesselAbbrev}:`,
    error
  );
};

/**
 * Calculates initial predictions when arriving terminal first becomes available.
 */
const calculateInitialPredictionsIfNeeded = async (
  ctx: ActionCtx,
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip,
  updates: ReturnType<typeof calculateTripUpdates>
): Promise<{
  LeftDockPred?: number;
  LeftDockPredMae?: number;
  EtaPred?: number;
  EtaPredMae?: number;
}> => {
  if (!updates.arrivingTerminalBecameAvailable) {
    return {};
  }

  try {
    const predictions = await calculateInitialPredictions(
      ctx,
      existingTrip,
      existingTrip
    );

    if (predictions.LeftDockPred) {
      console.log(
        `[ML Prediction] LeftDockPred calculated for ${existingTrip.VesselAbbrev}:`,
        {
          vessel: existingTrip.VesselAbbrev,
          departingTerminal: existingTrip.DepartingTerminalAbbrev,
          arrivingTerminal: currLocation.ArrivingTerminalAbbrev,
          scheduledDeparture: existingTrip.ScheduledDeparture,
          predictedLeftDock: predictions.LeftDockPred,
          leftDockMae: predictions.LeftDockPredMae,
        }
      );
    } else {
      console.log(
        `[ML Prediction] LeftDockPred skipped for ${existingTrip.VesselAbbrev}`,
        {
          vessel: existingTrip.VesselAbbrev,
          reason: "Insufficient data or model not found",
        }
      );
    }

    if (predictions.EtaPred) {
      console.log(
        `[ML Prediction] EtaPred calculated for ${existingTrip.VesselAbbrev}:`,
        {
          vessel: existingTrip.VesselAbbrev,
          departingTerminal: existingTrip.DepartingTerminalAbbrev,
          arrivingTerminal: currLocation.ArrivingTerminalAbbrev,
          tripStart: existingTrip.TripStart,
          predictedEta: predictions.EtaPred,
          etaMae: predictions.EtaPredMae,
        }
      );
    } else {
      console.log(
        `[ML Prediction] EtaPred skipped for ${existingTrip.VesselAbbrev}`,
        {
          vessel: existingTrip.VesselAbbrev,
          reason: "Insufficient data or model not found",
        }
      );
    }

    return {
      LeftDockPred: predictions.LeftDockPred,
      LeftDockPredMae: predictions.LeftDockPredMae,
      EtaPred: predictions.EtaPred,
      EtaPredMae: predictions.EtaPredMae,
    };
  } catch (error) {
    console.error(
      `[ML Prediction] Failed to calculate initial predictions for ${existingTrip.VesselAbbrev}:`,
      error
    );
    return {};
  }
};

/**
 * Builds the updated trip object with all changes and prediction updates.
 */
const buildUpdatedTrip = (
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip,
  updates: ReturnType<typeof calculateTripUpdates>,
  initialPredictions: {
    LeftDockPred?: number;
    LeftDockPredMae?: number;
    EtaPred?: number;
    EtaPredMae?: number;
  },
  etaPrediction: { EtaPred?: number; EtaPredMae?: number }
): ConvexVesselTrip => ({
  ...existingTrip,
  ArrivingTerminalAbbrev: currLocation.ArrivingTerminalAbbrev,
  AtDock: currLocation.AtDock,
  Eta: currLocation.Eta,
  LeftDock: currLocation.LeftDock,
  Delay: updates.delay,
  AtDockDuration: updates.atDockDuration,
  ...initialPredictions,
  ...etaPrediction,
});

/**
 * Calculates delay in minutes from scheduled departure to actual departure.
 *
 * This function computes the difference between the actual departure time and the
 * scheduled departure time, returning the delay in minutes. A positive delay indicates
 * the vessel departed late, while a negative value would indicate early departure.
 *
 * @param scheduled - Scheduled departure time in milliseconds since epoch
 * @param actual - Actual departure time in milliseconds since epoch
 * @returns Delay in minutes, or `undefined` if either parameter is invalid or missing
 */
const calculateDelay = (
  scheduled: number | undefined,
  actual: number | undefined
): number | undefined => {
  if (!scheduled || !actual) {
    return undefined;
  }
  return roundToPrecision((actual - scheduled) / (1000 * 60), 10);
};

/**
 * Rounds a number to a specified precision.
 *
 * This utility function provides controlled rounding by multiplying the value by the
 * precision factor, rounding to the nearest integer, and then dividing back.
 *
 * @param value - The numeric value to round
 * @param precision - The precision factor (e.g., 10 for 1 decimal place, 100 for 2 decimal places)
 * @returns The rounded number
 */
const roundToPrecision = (value: number, precision: number): number =>
  Math.round(value * precision) / precision;
