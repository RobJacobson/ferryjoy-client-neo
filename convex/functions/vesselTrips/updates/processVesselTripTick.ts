/**
 * Vessel trip tick processor (build-then-compare pipeline).
 *
 * For each tick, builds the full intended trip state, compares to existing,
 * and writes only when different. Trip boundaries are handled locally with immediate
 * mutations.
 *
 * Invariants and event conditions:
 * - One active trip per vessel (keyed by `VesselAbbrev`) in `activeVesselTrips`.
 * - `firstTrip`: no existing active trip for `VesselAbbrev` → create active.
 * - `tripBoundary`: `DepartingTerminalAbbrev` changes → complete + start new (mutation).
 * - `didJustLeaveDock`: `LeftDock` transitions undefined → defined → backfill (mutation).
 */
import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { addPredictionsToTrip } from "domain/ml/prediction";
import type { ConvexPredictionRecord } from "functions/predictions/schemas";
import { extractPredictionRecord } from "functions/predictions/utils";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { buildTripFromRawData } from "./buildTrip";
import {
  lookupArrivalTerminalFromSchedule,
  lookupScheduledTrip,
} from "./lookupScheduledTrip";
import { tripsAreEqual, updateAndExtractPredictions } from "./utils";

export type VesselTripTickBatch = {
  activeUpsert?: ConvexVesselTrip;
  completedPredictionRecords: ConvexPredictionRecord[];
};

/**
 * Build tick result for a single vessel's location.
 *
 * Uses build-then-compare for regular updates: constructs full intended state,
 * compares to existing, writes only if different. Errors are logged and
 * discarded; returns empty result on failure.
 *
 * @param ctx - Convex action context
 * @param params.existingTrip - Active trip for vessel (undefined if first trip)
 * @param params.currLocation - Current vessel location tick
 * @returns Per-vessel tick result (active upsert and prediction records)
 */
export const processVesselTripTick = async (
  ctx: ActionCtx,
  params: {
    existingTrip: ConvexVesselTrip | undefined;
    currLocation: ConvexVesselLocation;
  }
): Promise<VesselTripTickBatch> => {
  const { existingTrip, currLocation } = params;
  const completedPredictionRecords: ConvexPredictionRecord[] = [];

  // ============================================================================
  // Stage 0: identify event type
  // ============================================================================
  if (!existingTrip) {
    const newTrip = buildTripFromRawData(currLocation);
    return { activeUpsert: newTrip, completedPredictionRecords };
  }

  const isTripBoundary =
    existingTrip.DepartingTerminalAbbrev !==
    currLocation.DepartingTerminalAbbrev;

  if (isTripBoundary) {
    // Build completed trip with durations
    const existingTripClean = stripConvexMeta(existingTrip) as ConvexVesselTrip;

    const completedTripBase: ConvexVesselTrip = {
      ...existingTripClean,
      TripEnd: currLocation.TimeStamp,
    };

    const atSeaDuration = calculateTimeDelta(
      completedTripBase.LeftDock,
      completedTripBase.TripEnd
    );
    if (atSeaDuration !== undefined) {
      completedTripBase.AtSeaDuration = atSeaDuration;
    }

    const totalDuration = calculateTimeDelta(
      completedTripBase.TripStart,
      completedTripBase.TripEnd
    );
    if (totalDuration !== undefined) {
      completedTripBase.TotalDuration = totalDuration;
    }

    // Actualize predictions and extract records
    const { updatedTrip: completedTrip, completedRecords } =
      updateAndExtractPredictions(existingTripClean, completedTripBase);

    // Build new trip with Prev* from completed trip
    const baseForLookup = buildTripFromRawData(
      currLocation,
      undefined,
      completedTrip
    );
    const arrivalLookup = await lookupArrivalTerminalFromSchedule(
      ctx,
      baseForLookup,
      currLocation
    );
    const newTrip = buildTripFromRawData(
      currLocation,
      undefined,
      completedTrip,
      arrivalLookup
    );

    // Derive Key / ScheduledTrip snapshot and compute at-dock predictions for the
    // newly-started trip (so UI sees them on the same tick as arrival).
    const tripWithScheduled = await lookupScheduledTrip(
      ctx,
      newTrip,
      arrivalLookup?.scheduledTripDoc,
      undefined
    );

    const tripWithPredictions = await addPredictionsToTrip(
      ctx,
      tripWithScheduled,
      undefined
    );

    await ctx.runMutation(
      api.functions.vesselTrips.mutations.completeAndStartNewTrip,
      { completedTrip, newTrip: tripWithPredictions }
    );

    return {
      activeUpsert: undefined,
      completedPredictionRecords: completedRecords,
    };
  }

  // Regular update path: build → schedule → predictions → actualize
  const baseTripForLookup: ConvexVesselTrip = {
    ...existingTrip,
    ScheduledDeparture:
      currLocation.ScheduledDeparture ?? existingTrip.ScheduledDeparture,
  };
  const arrivalLookup = await lookupArrivalTerminalFromSchedule(
    ctx,
    baseTripForLookup,
    currLocation
  );

  const baseTrip = buildTripFromRawData(
    currLocation,
    existingTrip,
    undefined,
    arrivalLookup
  );
  const tripWithSchedule = await lookupScheduledTrip(
    ctx,
    baseTrip,
    arrivalLookup?.scheduledTripDoc,
    existingTrip
  );

  const didJustLeaveDock =
    existingTrip.LeftDock === undefined &&
    tripWithSchedule.LeftDock !== undefined;

  const tripWithPredictions = await addPredictionsToTrip(
    ctx,
    tripWithSchedule,
    existingTrip
  );

  const { updatedTrip: enrichedTrip, completedRecords: predictionRecords } =
    didJustLeaveDock
      ? updateAndExtractPredictions(existingTrip, tripWithPredictions)
      : { updatedTrip: tripWithPredictions, completedRecords: [] };

  const finalProposed: ConvexVesselTrip = {
    ...enrichedTrip,
    TimeStamp: currLocation.TimeStamp,
  };

  const activeUpsert = tripsAreEqual(existingTrip, finalProposed)
    ? undefined
    : finalProposed;

  if (didJustLeaveDock) {
    const leftDockMs = enrichedTrip.LeftDock;
    if (leftDockMs !== undefined) {
      const backfillResult = await ctx.runMutation(
        api.functions.vesselTrips.mutations
          .setDepartNextActualsForMostRecentCompletedTrip,
        {
          vesselAbbrev: existingTrip.VesselAbbrev,
          actualDepartMs: leftDockMs,
        }
      );
      if (
        backfillResult?.updated === true &&
        backfillResult?.updatedTrip !== undefined
      ) {
        const tripData = stripConvexMeta(
          backfillResult.updatedTrip as Record<string, unknown>
        ) as ConvexVesselTrip;
        const departNextRecords = [
          extractPredictionRecord(tripData, "AtDockDepartNext"),
          extractPredictionRecord(tripData, "AtSeaDepartNext"),
        ].filter((r): r is ConvexPredictionRecord => r !== null);
        predictionRecords.push(...departNextRecords);
      }
    }
  }

  return { activeUpsert, completedPredictionRecords: predictionRecords };
};
