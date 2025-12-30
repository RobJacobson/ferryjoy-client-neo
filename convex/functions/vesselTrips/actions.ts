import { api } from "_generated/api";
import { type ActionCtx, internalAction } from "_generated/server";
import {
  predictDelayOnArrival,
  predictEtaOnArrival,
  predictEtaOnDeparture,
} from "domain/ml/prediction/predictors";
import {
  type ConvexVesselLocation,
  toConvexVesselLocation,
} from "functions/vesselLocation/schemas";
import {
  type ConvexVesselTrip,
  toConvexVesselTrip,
} from "functions/vesselTrips/schemas";
import { convertConvexVesselLocation } from "shared/convertVesselLocations";
import { calculateTimeDelta } from "shared/durationUtils";
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

  // Create a new trip object with the completed trip's at-sea duration and total duration
  const newTrip = toConvexVesselTrip(currLocation, {
    TripStart: currLocation.TimeStamp,
    PrevAtSeaDuration: completedTrip.AtSeaDuration,
    PrevTripDelay: completedTrip.TripDelay,
  });

  const newTripWithPredictions = {
    ...newTrip,
    ...(await getTripDelayPrediction(ctx, newTrip)),
    ...(await getEtaArrivalPrediction(ctx, newTrip)),
    ...(await getEtaDeparturePrediction(ctx, newTrip)),
  };

  // Complete and start a new trip by upserting the completed trip and the new trip
  await ctx.runMutation(
    api.functions.vesselTrips.mutations.completeAndStartNewTrip,
    {
      completedTrip,
      newTrip: newTripWithPredictions,
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
    InService: currLocation.InService,
    TripDelay: calculateTimeDelta(
      currLocation.ScheduledDeparture,
      currLocation.LeftDock
    ),
    AtDockDuration: calculateTimeDelta(
      existingTrip.TripStart,
      currLocation.LeftDock
    ),
  };

  // Combine the updated trip with the predictions
  const updatedTripWithPredictions = {
    ...updatedTrip,
    ...(await getTripDelayPrediction(ctx, updatedTrip)),
    ...(await getEtaArrivalPrediction(ctx, updatedTrip)),
    ...(await getEtaDeparturePrediction(ctx, updatedTrip)),
  };

  if (equals(updatedTripWithPredictions, existingTrip)) {
    return;
  }

  console.log("Updated trip:", updatedTripWithPredictions);
  await ctx.runMutation(api.functions.vesselTrips.mutations.upsertActiveTrip, {
    trip: { ...updatedTripWithPredictions, TimeStamp: currLocation.TimeStamp },
  });
};

const equals = (a: ConvexVesselTrip, b: ConvexVesselTrip): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

// const equals = (a: ConvexVesselTrip, b: ConvexVesselTrip): boolean =>
//   Object.keys(a).length === Object.keys(b).length &&
//   Object.keys(a).every(
//     (key) =>
//       a[key as keyof ConvexVesselTrip] === b[key as keyof ConvexVesselTrip]
//   );

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
 * Generates delay prediction for a trip if not already calculated.
 *
 * @param ctx - Convex action context for running ML predictions
 * @param trip - The trip to predict delay for
 * @returns Promise resolving to delay prediction or empty object if prediction fails
 */
const getTripDelayPrediction = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip
): Promise<{
  TripDelayPred?: number;
  TripDelayPredMae?: number;
}> => {
  if (
    trip.TripDelayPred === undefined &&
    trip.ArrivingTerminalAbbrev !== undefined
  ) {
    try {
      const prediction = await predictDelayOnArrival(ctx, trip);
      console.log(
        `[Prediction] Delay prediction for ${trip.VesselAbbrev}:`,
        prediction
      );
      return {
        TripDelayPred: prediction.predictedTime,
        TripDelayPredMae: prediction.mae,
      };
    } catch (error) {
      console.error(
        `[Prediction] Delay prediction failed for ${trip.VesselAbbrev}:`,
        error
      );
    }
  }
  return {};
};

/**
 * Generates departure ETA prediction when vessel leaves dock.
 *
 * @param ctx - Convex action context for running ML predictions
 * @param trip - The trip to predict departure ETA for
 * @returns Promise resolving to departure ETA prediction or empty object if prediction fails
 */
const getEtaDeparturePrediction = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip
): Promise<{
  EtaPredDepart?: number;
  EtaPredDepartMae?: number;
}> => {
  // Only generate if not already calculated and vessel has left dock
  if (
    trip.EtaPredDepart === undefined &&
    trip.AtDock === false &&
    trip.LeftDock === undefined
  ) {
    try {
      const prediction = await predictEtaOnDeparture(ctx, trip);
      console.log(
        `[Prediction] Departure ETA for ${trip.VesselAbbrev}:`,
        prediction
      );
      return {
        EtaPredDepart: prediction.predictedTime,
        EtaPredDepartMae: prediction.mae,
      };
    } catch (error) {
      console.error(
        `[Prediction] Departure ETA failed for ${trip.VesselAbbrev}:`,
        error
      );
    }
  }
  return {};
};

/**
 * Generates arrival ETA prediction for a trip if not already calculated.
 *
 * @param ctx - Convex action context for running ML predictions
 * @param trip - The trip to predict ETA for
 * @returns Promise resolving to arrival ETA prediction or empty object if prediction fails
 */
const getEtaArrivalPrediction = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip
): Promise<{
  EtaPredArrive?: number;
  EtaPredArriveMae?: number;
}> => {
  if (
    trip.EtaPredDepart === undefined &&
    trip.ArrivingTerminalAbbrev !== undefined
  ) {
    try {
      const prediction = await predictEtaOnArrival(ctx, trip);
      console.log(
        `[Prediction] ETA prediction for ${trip.VesselAbbrev}:`,
        prediction
      );
      return {
        EtaPredArrive: prediction.predictedTime,
        EtaPredArriveMae: prediction.mae,
      };
    } catch (error) {
      console.error(
        `[Prediction] ETA prediction failed for ${trip.VesselAbbrev}:`,
        error
      );
    }
  }
  return {};
};
