import { api } from "_generated/api";
import { type ActionCtx, internalAction } from "_generated/server";
import {
  calculateInitialPredictions,
  predictDelayOnArrival,
  predictEtaOnDeparture,
} from "domain/ml";
import {
  type ConvexVesselLocation,
  toConvexVesselLocation,
} from "functions/vesselLocation/schemas";
import {
  type ConvexVesselTrip,
  isPredictionReady,
  type PredictionReadyTrip,
  toConvexVesselTrip,
} from "functions/vesselTrips/schemas";
import { convertConvexVesselLocation } from "shared/convertVesselLocations";
import { calculateTimeDelta } from "shared/durationUtils";
import { processPredictionResult } from "shared/predictionUtils";
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

    // 3. Get a list of current convex vessel locations
    const convexVesselLocations = (
      (await fetchVesselLocations()) as unknown as DottieVesselLocation[]
    )
      .map(toConvexVesselLocation)
      .map(convertConvexVesselLocation);

    // 4. Process each vessel location
    for (const currLocation of convexVesselLocations) {
      const existingTrip = existingTripsDict[currLocation.VesselAbbrev];

      // Case (a): First trip - no existing trip
      if (isFirstTrip(existingTrip)) {
        await handleFirstTrip(ctx, currLocation);
        continue;
      }

      // Case (b): New trip - departing terminal changed
      if (isNewTrip(existingTrip, currLocation)) {
        await handleNewTrip(ctx, existingTrip, currLocation);
        continue;
      }

      // Case (c): Update trip - existing trip needs data updates
      await handleTripUpdate(ctx, currLocation, existingTrip);
    }
  },
});

/**
 * Handles the first trip for a vessel by creating and upserting the active trip.
 *
 * @param ctx - The Convex action context for running mutations
 * @param currLocation - The current vessel location data from WSF API
 */
const handleFirstTrip = async (
  ctx: ActionCtx,
  currLocation: ConvexVesselLocation
): Promise<void> => {
  const newTrip = toConvexVesselTrip(currLocation, {
    TripStart: undefined,
  });

  await ctx.runMutation(api.functions.vesselTrips.mutations.upsertActiveTrip, {
    trip: newTrip,
  });
};

/**
 * Handles a new trip by completing the existing trip and starting a new one with predictions.
 *
 * @param ctx - The Convex action context for running mutations
 * @param existingTrip - The existing trip to complete
 * @param currLocation - The current vessel location data from WSF API
 */
const handleNewTrip = async (
  ctx: ActionCtx,
  existingTrip: ConvexVesselTrip,
  currLocation: ConvexVesselLocation
): Promise<void> => {
  // Creates a completed trip object by calculating final durations and setting TripEnd.
  const completedTrip = {
    ...existingTrip,
    TripEnd: currLocation.TimeStamp,
    AtSeaDuration: calculateTimeDelta(
      existingTrip.LeftDock,
      currLocation.TimeStamp
    ),
    TotalDuration: calculateTimeDelta(
      existingTrip.TripStart,
      currLocation.TimeStamp
    ),
  };

  // Create the new trip object with the completed trip's at-sea duration and total duration
  const newTrip = toConvexVesselTrip(currLocation, {
    TripStart: currLocation.TimeStamp,
    prevAtSeaDuration: completedTrip.AtSeaDuration,
    prevDelay: completedTrip.Delay,
  });

  // If the new trip has all required data for predictions, predict delay and ETA
  const predictions = isPredictionReady(newTrip)
    ? await generateInitialPredictions(ctx, completedTrip, newTrip)
    : {};

  // Complete and start a new trip by upserting the completed trip and the new trip
  await ctx.runMutation(
    api.functions.vesselTrips.mutations.completeAndStartNewTrip,
    {
      completedTrip,
      newTrip: { ...newTrip, ...predictions },
    }
  );
};

/**
 * Checks if trip data needs updating and applies updates to the active trip.
 *
 * This function builds an updated trip object with current data and predictions,
 * then performs a member-wise comparison with the existing trip. If any fields
 * have changed, the trip is updated in the database.
 *
 * @param ctx - The Convex action context for running mutations
 * @param currLocation - The current vessel location data from WSF API
 * @param existingTrip - The existing active trip for this vessel
 */
const handleTripUpdate = async (
  ctx: ActionCtx,
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip
) => {
  // Build the updated trip object with all current data
  const updatedTrip: ConvexVesselTrip = {
    ...existingTrip,
    ArrivingTerminalAbbrev: currLocation.ArrivingTerminalAbbrev,
    AtDock: currLocation.AtDock,
    Eta: currLocation.Eta,
    LeftDock: currLocation.LeftDock,
    ScheduledDeparture: currLocation.ScheduledDeparture,
    TimeStamp: currLocation.TimeStamp,
    InService: currLocation.InService,
    Delay: calculateTimeDelta(
      currLocation.ScheduledDeparture,
      currLocation.LeftDock
    ),
    AtDockDuration: calculateTimeDelta(
      existingTrip.TripStart,
      currLocation.LeftDock
    ),
  };

  // If the trip has not changed, do not update
  if (
    updatedTrip.ArrivingTerminalAbbrev ===
      existingTrip.ArrivingTerminalAbbrev &&
    updatedTrip.AtDock === existingTrip.AtDock &&
    updatedTrip.Eta === existingTrip.Eta &&
    updatedTrip.LeftDock === existingTrip.LeftDock &&
    updatedTrip.ScheduledDeparture === existingTrip.ScheduledDeparture &&
    updatedTrip.InService === existingTrip.InService &&
    updatedTrip.Delay === existingTrip.Delay &&
    updatedTrip.AtDockDuration === existingTrip.AtDockDuration
  ) {
    return;
  }

  // If the delay prediction is missing and the trip has all required data, predict the left dock
  const delayPredictions =
    updatedTrip.DelayPred === undefined && isPredictionReady(updatedTrip)
      ? await generateDelayPredictions(ctx, updatedTrip)
      : {};

  // If vessel just departed (AtDock changed from true to false), update ETA prediction with actual at-dock duration
  const departureEtaPredictions =
    updatedTrip.EtaPredDepart === undefined &&
    currLocation.AtDock === false &&
    currLocation.LeftDock !== undefined
      ? await generateDepartureEtaPredictions(ctx, updatedTrip, currLocation)
      : {};

  // Combine the updated trip with the predictions
  const updatedTripWithPredictions = {
    ...updatedTrip,
    ...delayPredictions,
    ...departureEtaPredictions,
  };

  console.log("Updated trip:", updatedTripWithPredictions);
  await ctx.runMutation(api.functions.vesselTrips.mutations.upsertActiveTrip, {
    trip: updatedTripWithPredictions,
  });
};

/**
 * Checks if this is the first trip for a vessel (no existing trip).
 *
 * @param existingTrip - The existing active trip for this vessel, or undefined if none exists
 * @returns `true` if this is the first trip, `false` otherwise
 */
const isFirstTrip = (existingTrip: ConvexVesselTrip | undefined): boolean =>
  !existingTrip;

/**
 * Checks if a new trip is needed based on departing terminal change.
 *
 * @param existingTrip - The existing active trip for this vessel
 * @param currLocation - The current vessel location data from WSF API
 * @returns `true` if the departing terminal has changed, `false` otherwise
 */
const isNewTrip = (
  existingTrip: ConvexVesselTrip,
  currLocation: ConvexVesselLocation
): boolean =>
  existingTrip.DepartingTerminalAbbrev !== currLocation.DepartingTerminalAbbrev;

/**
 * Generates delay predictions for a prediction-ready vessel trip.
 *
 * @param ctx - Convex action context for running ML predictions
 * @param trip - A vessel trip that has all required fields for predictions
 * @returns Promise resolving to prediction results or empty object if prediction fails
 */
const generateDelayPredictions = async (
  ctx: ActionCtx,
  trip: PredictionReadyTrip
): Promise<{ DelayPred?: number; DelayPredMae?: number }> => {
  const predictionParams = {
    scheduledDeparture: trip.ScheduledDeparture,
    departingTerminal: trip.DepartingTerminalAbbrev,
    arrivingTerminal: trip.ArrivingTerminalAbbrev,
    tripStart: trip.TripStart,
    previousDelay: trip.prevDelay,
    previousAtSeaDuration: trip.prevAtSeaDuration,
    vesselAbbrev: trip.VesselAbbrev,
  };

  const result = await predictDelayOnArrival(ctx, predictionParams);
  return (
    processPredictionResult(
      result.predictedTime,
      result.mae,
      trip.VesselAbbrev,
      predictionParams
    ) || {}
  );
};

/**
 * Generates initial predictions (both delay and ETA) for a new trip when vessel arrives at dock.
 *
 * @param ctx - Convex action context for running ML predictions
 * @param completedTrip - The trip that just completed
 * @param newTrip - The new trip that just started (must be prediction-ready)
 * @returns Promise resolving to prediction results or empty object if predictions fail
 */
const generateInitialPredictions = async (
  ctx: ActionCtx,
  completedTrip: ConvexVesselTrip,
  newTrip: PredictionReadyTrip
): Promise<{
  DelayPred?: number;
  DelayPredMae?: number;
  EtaPredArrive?: number;
  EtaPredArriveMae?: number;
}> => {
  try {
    const initialPredictions = await calculateInitialPredictions(
      ctx,
      completedTrip,
      newTrip
    );
    return {
      DelayPred: initialPredictions.DelayPred,
      DelayPredMae: initialPredictions.DelayPredMae,
      EtaPredArrive: initialPredictions.EtaPredArrive,
      EtaPredArriveMae: initialPredictions.EtaPredArriveMae,
    };
  } catch (error) {
    console.error(
      `[Prediction] Initial predictions failed for ${newTrip.VesselAbbrev}:`,
      error
    );
    return {};
  }
};

/**
 * Generates updated ETA predictions when vessel leaves dock using actual at-dock duration.
 *
 * @param ctx - Convex action context for running ML predictions
 * @param currentTrip - The current vessel trip with actual at-dock duration
 * @param currentLocation - The current vessel location data
 * @returns Promise resolving to ETA prediction results or empty object if prediction fails
 */
const generateDepartureEtaPredictions = async (
  ctx: ActionCtx,
  currentTrip: ConvexVesselTrip,
  currentLocation: ConvexVesselLocation
): Promise<{
  EtaPredDepart?: number;
  EtaPredDepartMae?: number;
}> => {
  try {
    const etaResult = await predictEtaOnDeparture(
      ctx,
      currentTrip,
      currentLocation
    );
    return {
      EtaPredDepart: etaResult.predictedTime,
      EtaPredDepartMae: etaResult.mae,
    };
  } catch (error) {
    console.error(
      `[Prediction] Departure ETA prediction failed for ${currentTrip.VesselAbbrev}:`,
      error
    );
    return {};
  }
};
