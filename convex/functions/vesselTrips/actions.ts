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
  const newTrip = toConvexVesselTrip(currLocation, {});

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
  // Creates a completed trip object by setting TripEnd.
  // Destructure to remove Convex internal fields that might be present
  const { _id, _creationTime, ...existingTripClean } =
    existingTrip as ConvexVesselTrip & { _id?: string; _creationTime?: number };
  const completedTripBase = {
    ...existingTripClean,
    TripEnd: currLocation.TimeStamp,
  };

  const completedTrip = {
    ...completedTripBase,
    ...updatePredictionsWithActuals(existingTripClean, completedTripBase),
  };

  // Create a new trip object
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
  // Enriches the trip fields for a trip
  const tripFieldUpdates = enrichTripFields(existingTrip, currLocation);
  const baseTrip: ConvexVesselTrip = {
    ...existingTrip,
    ...tripFieldUpdates,
  };

  // Enriches the scheduled trip fields for a trip
  const tripStartUpdates = await enrichTripStartUpdates(ctx, baseTrip);

  // Enriches the at dock predictions for a trip
  const atDockPredictions = await enrichAtDockPredictions(ctx, baseTrip);

  // Enriches the at sea predictions for a trip
  const atSeaPredictions = await enrichAtSeaPredictions(ctx, baseTrip);

  // Creates the trip to upsert
  const updatedData: Partial<ConvexVesselTrip> = {
    ...tripFieldUpdates,
    ...tripStartUpdates,
    ...atDockPredictions,
    ...atSeaPredictions,
  };

  // If the trip to upsert is empty, don't upsert
  if (Object.keys(updatedData).length === 0) {
    return;
  }

  console.log(currLocation.VesselAbbrev, Object.keys(updatedData), "updates:", {
    ...updatedData,
  });

  await ctx.runMutation(api.functions.vesselTrips.mutations.upsertActiveTrip, {
    trip: {
      ...existingTrip,
      ...updatedData,
      TimeStamp: currLocation.TimeStamp,
    },
  });
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Clears derived ScheduledTrip fields and prediction fields when the computed key
 * changes, ensuring we don't retain stale data from a previous trip identity.
 */
const CLEAR_DERIVED_TRIP_DATA_ON_KEY_CHANGE: Partial<ConvexVesselTrip> = {
  RouteID: 0,
  RouteAbbrev: "",
  SailingDay: "",
  SailingNotes: "",
  Annotations: [],
  NextKey: undefined,
  EstArriveNext: undefined,
  EstArriveCurr: undefined,
  ArrivingTime: undefined,
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
};

const deriveTripKey = (trip: ConvexVesselTrip): string | null => {
  if (
    !trip.ScheduledDeparture ||
    !trip.DepartingTerminalAbbrev ||
    !trip.ArrivingTerminalAbbrev
  ) {
    return null;
  }

  return (
    generateTripKey(
      trip.VesselAbbrev,
      trip.DepartingTerminalAbbrev,
      trip.ArrivingTerminalAbbrev,
      new Date(trip.ScheduledDeparture)
    ) ?? null
  );
};

const shouldLookupScheduledTrip = (
  trip: ConvexVesselTrip,
  tripKey: string
): { shouldLookup: boolean; existingKeyMismatch: boolean } => {
  const existingKeyMismatch = trip.Key !== undefined && trip.Key !== tripKey;
  const hasExistingKey = trip.Key !== undefined;

  if (existingKeyMismatch || !hasExistingKey) {
    return { shouldLookup: true, existingKeyMismatch };
  }

  const hasScheduledTripData = trip.SailingDay !== "" && trip.RouteID !== 0;
  const seconds = new Date().getSeconds();
  return {
    shouldLookup: !hasScheduledTripData && seconds < 15,
    existingKeyMismatch,
  };
};

/**
 * Enriches the trip fields for a trip.
 *
 * @param existingTrip - The existing trip to enrich
 * @param currLocation - The current vessel location data from WSF API
 * @returns The enriched trip fields
 */
const enrichTripFields = (
  existingTrip: ConvexVesselTrip,
  currLocation: ConvexVesselLocation
): Partial<ConvexVesselTrip> => {
  // Creates the updates object
  const updates: Partial<ConvexVesselTrip> = {};

  // If the vessel's arriving terminal has changed, update the arriving terminal
  if (
    currLocation.ArrivingTerminalAbbrev !== existingTrip.ArrivingTerminalAbbrev
  ) {
    updates.ArrivingTerminalAbbrev = currLocation.ArrivingTerminalAbbrev;
  }

  // If the vessel's at dock status has changed, update the at dock status
  if (currLocation.AtDock !== existingTrip.AtDock) {
    updates.AtDock = currLocation.AtDock;
  }

  // If the vessel's estimated arrival time has changed, update the estimated arrival time
  if (currLocation.Eta !== existingTrip.Eta) {
    updates.Eta = currLocation.Eta;
  }

  // If the vessel's left dock time has changed, update the left dock time
  if (currLocation.LeftDock !== existingTrip.LeftDock) {
    updates.LeftDock = currLocation.LeftDock;
  }

  // If the vessel's scheduled departure time has changed, update the scheduled departure time
  if (currLocation.ScheduledDeparture !== existingTrip.ScheduledDeparture) {
    updates.ScheduledDeparture = currLocation.ScheduledDeparture;
  }

  // If the vessel's trip delay has changed, update the trip delay
  const tripDelay = calculateTimeDelta(
    currLocation.ScheduledDeparture,
    currLocation.LeftDock
  );

  // If the vessel's trip delay has changed, update the trip delay
  if (tripDelay !== undefined && tripDelay !== existingTrip.TripDelay) {
    updates.TripDelay = tripDelay;
  }

  // Return the updates
  return updates;
};

/**
 * Enriches the scheduled trip fields for a trip.
 *
 * @param ctx - The Convex action context for running mutations
 * @param updatedTrip - The updated trip to enrich
 * @returns The enriched scheduled trip fields
 */
const enrichTripStartUpdates = async (
  ctx: ActionCtx,
  updatedTrip: ConvexVesselTrip
): Promise<Partial<ConvexVesselTrip>> => {
  const tripKey = deriveTripKey(updatedTrip);
  if (!tripKey) {
    return {};
  }

  const { shouldLookup, existingKeyMismatch } = shouldLookupScheduledTrip(
    updatedTrip,
    tripKey
  );

  // If we can compute a key, keep it in sync even if we don't look up yet.
  const keyPatch: Partial<ConvexVesselTrip> =
    updatedTrip.Key === tripKey ? {} : { Key: tripKey };
  const invalidationPatch = existingKeyMismatch
    ? CLEAR_DERIVED_TRIP_DATA_ON_KEY_CHANGE
    : {};

  // We already have ScheduledTrip data, or we're backing off—no lookup needed.
  if (!shouldLookup) {
    return keyPatch;
  }

  // Query the ScheduledTrip
  try {
    console.log("Querying ScheduledTrip for key:", tripKey);
    const scheduledTrip = await fetchScheduledTripFieldsByKey(ctx, tripKey);
    if (scheduledTrip) {
      return {
        ...scheduledTrip,
        ...keyPatch,
      };
    } else {
      console.log(`No matching ScheduledTrip found for key: ${tripKey}`);
    }
  } catch (error) {
    console.log(`Error querying ScheduledTrip for key ${tripKey}:`, error);
    return {
      ...keyPatch,
      ...invalidationPatch,
    };
  }

  return {
    ...keyPatch,
    ...invalidationPatch,
  };
};

const fetchScheduledTripFieldsByKey = async (
  ctx: ActionCtx,
  tripKey: string
): Promise<Partial<ConvexVesselTrip> | null> => {
  const scheduledTripDoc = await ctx.runQuery(
    api.functions.scheduledTrips.queries.getScheduledTripByKey,
    { key: tripKey }
  );

  if (!scheduledTripDoc) {
    return null;
  }

  const { _id, _creationTime, ...scheduledTrip } = scheduledTripDoc;
  return scheduledTrip as Partial<ConvexVesselTrip>;
};

/**
 * Enriches the at dock predictions for a trip.
 *
 * @param ctx - The Convex action context for running mutations
 * @param updatedTrip - The updated trip to enrich
 * @returns The enriched at dock predictions
 */
const enrichAtDockPredictions = async (
  ctx: ActionCtx,
  updatedTrip: ConvexVesselTrip
): Promise<Partial<ConvexVesselTrip>> => {
  // If the trip is missing required fields, we don't need to predict
  if (
    !updatedTrip.TripStart ||
    !updatedTrip.ArrivingTerminalAbbrev ||
    !updatedTrip.PrevScheduledDeparture ||
    !updatedTrip.PrevTerminalAbbrev
  ) {
    return {};
  }

  const updates: Partial<ConvexVesselTrip> = {};

  if (!updatedTrip.AtDockDepartCurr) {
    const departCurrPrediction = await predictAtDockDepartCurr(
      ctx,
      updatedTrip
    );
    if (departCurrPrediction) {
      updates.AtDockDepartCurr = departCurrPrediction;
    }
  }

  if (!updatedTrip.AtDockArriveNext) {
    const arriveNextPrediction = await predictAtDockArriveNext(
      ctx,
      updatedTrip
    );
    if (arriveNextPrediction) {
      updates.AtDockArriveNext = arriveNextPrediction;
    }
  }

  return updates;
};

const enrichAtSeaPredictions = async (
  ctx: ActionCtx,
  updatedTrip: ConvexVesselTrip
): Promise<Partial<ConvexVesselTrip>> => {
  // If the trip doesn't have a departing terminal or we haven't left dock, we don't need to predict
  if (
    !updatedTrip.DepartingTerminalAbbrev ||
    !updatedTrip.LeftDock ||
    !updatedTrip.TripStart
  ) {
    return {};
  }

  if (updatedTrip.AtSeaArriveNext) {
    return {};
  }

  // Predict the arrival next prediction
  const arriveNextPrediction = await predictAtSeaArriveNext(ctx, updatedTrip);
  if (!arriveNextPrediction) {
    return {};
  }

  return { AtSeaArriveNext: arriveNextPrediction };
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
