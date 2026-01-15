import { api } from "_generated/api";
import { type ActionCtx, internalAction } from "_generated/server";
import {
  predictAtDockArriveNext,
  predictAtDockDepartCurr,
  predictAtSeaArriveNext,
  updatePredictionsWithActuals,
} from "domain/ml/prediction";
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
import { generateTripKey } from "shared/keys";
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
    TripStart: currLocation.TimeStamp,
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
  const completedTripBase = {
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

  const completedTrip = {
    ...completedTripBase,
    ...updatePredictionsWithActuals(existingTrip, completedTripBase),
  };

  // Create a new trip object with the completed trip's at-sea duration and total duration
  const newTrip = toConvexVesselTrip(currLocation, {
    TripStart: currLocation.TimeStamp,
    // PrevTerminalAbbrev represents the *previous trip's departing terminal*
    // (A in A->B then B->C). This is used by ML features as the origin of the
    // previous leg (A->B), not the previous leg's arrival (B).
    PrevTerminalAbbrev: completedTrip.DepartingTerminalAbbrev,
    PrevScheduledDeparture: completedTrip.ScheduledDeparture,
    PrevLeftDock: completedTrip.LeftDock,
  });

  // Complete and start a new trip by upserting the completed trip and the new trip
  await ctx.runMutation(
    api.functions.vesselTrips.mutations.completeAndStartNewTrip,
    {
      completedTrip,
      newTrip,
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
  const tripFieldUpdates = getTripFieldUpdatesFromLocation(
    existingTrip,
    currLocation
  );

  const updatedTrip: ConvexVesselTrip = {
    ...existingTrip,
    ...tripFieldUpdates,
  };

  const didStartTrip =
    !existingTrip.ArrivingTerminalAbbrev &&
    Boolean(currLocation.ArrivingTerminalAbbrev);

  const didLeaveDock = !existingTrip.LeftDock && Boolean(currLocation.LeftDock);

  const predictionUpdates: Partial<ConvexVesselTrip> = {
    ...(didStartTrip
      ? await handleStartTrip(ctx, {
          existingTrip,
          updatedTrip,
        })
      : {}),
    ...(didLeaveDock
      ? await handleLeftDock(ctx, {
          existingTrip,
          updatedTrip,
        })
      : {}),
  };

  const updatedTripWithPredictions: ConvexVesselTrip = {
    ...updatedTrip,
    ...predictionUpdates,
  };

  const predictionActualUpdates = updatePredictionsWithActuals(
    existingTrip,
    updatedTripWithPredictions
  );

  const tripToUpsert: ConvexVesselTrip = {
    ...updatedTripWithPredictions,
    ...predictionActualUpdates,
  };

  if (
    Object.keys(tripFieldUpdates).length === 0 &&
    Object.keys(predictionUpdates).length === 0 &&
    Object.keys(predictionActualUpdates).length === 0
  ) {
    return;
  }

  await ctx.runMutation(api.functions.vesselTrips.mutations.upsertActiveTrip, {
    trip: tripToUpsert,
  });
};

// ============================================================================
// HELPERS
// ============================================================================

const getTripFieldUpdatesFromLocation = (
  existingTrip: ConvexVesselTrip,
  currLocation: ConvexVesselLocation
): Partial<ConvexVesselTrip> => {
  const updates: Partial<ConvexVesselTrip> = {};

  if (
    currLocation.ArrivingTerminalAbbrev !== existingTrip.ArrivingTerminalAbbrev
  ) {
    updates.ArrivingTerminalAbbrev = currLocation.ArrivingTerminalAbbrev;
  }

  if (currLocation.AtDock !== existingTrip.AtDock) {
    updates.AtDock = currLocation.AtDock;
  }

  if (currLocation.Eta !== existingTrip.Eta) {
    updates.Eta = currLocation.Eta;
  }

  if (currLocation.LeftDock !== existingTrip.LeftDock) {
    updates.LeftDock = currLocation.LeftDock;
  }

  if (currLocation.ScheduledDeparture !== existingTrip.ScheduledDeparture) {
    updates.ScheduledDeparture = currLocation.ScheduledDeparture;
  }

  const tripDelay = calculateTimeDelta(
    currLocation.ScheduledDeparture,
    currLocation.LeftDock
  );
  if (tripDelay !== undefined && tripDelay !== existingTrip.TripDelay) {
    updates.TripDelay = tripDelay;
  }

  const atDockDuration = calculateTimeDelta(
    existingTrip.TripStart,
    currLocation.LeftDock
  );
  if (
    atDockDuration !== undefined &&
    atDockDuration !== existingTrip.AtDockDuration
  ) {
    updates.AtDockDuration = atDockDuration;
  }

  return updates;
};

const handleStartTrip = async (
  ctx: ActionCtx,
  args: {
    existingTrip: ConvexVesselTrip;
    updatedTrip: ConvexVesselTrip;
  }
): Promise<Partial<ConvexVesselTrip>> => {
  const updates: Partial<ConvexVesselTrip> = {};

  if (!args.updatedTrip.AtDock || args.updatedTrip.LeftDock) {
    return updates;
  }

  if (
    args.existingTrip.AtDockDepartCurr ||
    args.existingTrip.AtDockArriveNext
  ) {
    return updates;
  }

  // Generate key and query for corresponding ScheduledTrip
  const tripKey = generateTripKey(
    args.updatedTrip.VesselAbbrev,
    args.updatedTrip.DepartingTerminalAbbrev,
    args.updatedTrip.ArrivingTerminalAbbrev,
    new Date(args.updatedTrip.DepartingTime)
  );

  if (tripKey) {
    try {
      const scheduledTrip = await ctx.runQuery(
        api.functions.scheduledTrips.queries.getScheduledTripByKey,
        { key: tripKey }
      );

      if (scheduledTrip) {
        // Copy ScheduledTrip information into VesselTrip using spread
        Object.assign(updates, scheduledTrip);
      } else {
        console.log(`No matching ScheduledTrip found for key: ${tripKey}`);
      }
    } catch (error) {
      console.log(`Error querying ScheduledTrip for key ${tripKey}:`, error);
    }
  }

  const departCurrPrediction = await predictAtDockDepartCurr(
    ctx,
    args.updatedTrip
  );
  if (departCurrPrediction) {
    updates.AtDockDepartCurr = departCurrPrediction;
  }

  const arriveNextPrediction = await predictAtDockArriveNext(
    ctx,
    args.updatedTrip
  );
  if (arriveNextPrediction) {
    updates.AtDockArriveNext = arriveNextPrediction;
  }

  return updates;
};

const handleLeftDock = async (
  ctx: ActionCtx,
  args: {
    existingTrip: ConvexVesselTrip;
    updatedTrip: ConvexVesselTrip;
  }
): Promise<Partial<ConvexVesselTrip>> => {
  const updates: Partial<ConvexVesselTrip> = {};

  if (!args.updatedTrip.LeftDock) {
    return updates;
  }

  if (args.existingTrip.AtSeaArriveNext) {
    return updates;
  }

  const arriveNextPrediction = await predictAtSeaArriveNext(
    ctx,
    args.updatedTrip
  );
  if (arriveNextPrediction) {
    updates.AtSeaArriveNext = arriveNextPrediction;
  }

  return updates;
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
