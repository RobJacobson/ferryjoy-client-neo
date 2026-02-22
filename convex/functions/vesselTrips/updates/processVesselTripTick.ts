/**
 * Vessel trip tick processor (build-then-compare pipeline).
 *
 * For each tick, builds the full intended trip state, compares to existing,
 * and emits a vessel trip batch for only what changed. Regular updates use deep
 * equality to skip writes when semantic state is unchanged.
 *
 * Completions and depart-next backfills are handled locally where detected:
 * - Trip boundary: calls completeAndStartNewTrip immediately (no return).
 * - didJustLeaveDock: calls setDepartNextActualsForMostRecentCompletedTrip
 *   immediately, extracts prediction records (no return).
 *
 * Invariants and event conditions:
 * - One active trip per vessel (keyed by `VesselAbbrev`) in `activeVesselTrips`.
 * - `firstTrip`: no existing active trip for `VesselAbbrev` → create active.
 * - `tripBoundary`: `DepartingTerminalAbbrev` changes → complete + start new (mutation).
 * - `didJustLeaveDock`: `LeftDock` transitions undefined → defined → backfill (mutation).
 */
import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexPredictionRecord } from "functions/predictions/schemas";
import { extractPredictionRecord } from "functions/predictions/utils";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import {
  type ConvexVesselTrip,
  toConvexVesselTrip,
} from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { lookupArrivalTerminalFromSchedule } from "./arrivalTerminalLookup";
import { buildCompleteTrip } from "./buildCompleteTrip";
import { buildAndEnrichTrip } from "./buildAndEnrichTrip";
import {
  finalizeCompletedTripPredictions,
  processPredictionsForTrip,
} from "./predictionFacade";
import { enrichTripStartUpdates } from "./scheduledTripEnrichment";
import { tripsAreEqual } from "./tripEquality";

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
 * @param existingTripsDict - Active trips indexed by vessel abbreviation
 * @param currLocation - Current vessel location tick
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
    const newTrip = toConvexVesselTrip(currLocation, {});
    return { activeUpsert: newTrip, completedPredictionRecords };
  }

  const isTripBoundary =
    existingTrip.DepartingTerminalAbbrev !==
    currLocation.DepartingTerminalAbbrev;

  if (isTripBoundary) {
    return await buildTripBoundaryBatch(ctx, {
      existingTrip,
      currLocation,
    });
  }

  return await buildTripUpdateBatch(ctx, {
    existingTrip,
    currLocation,
  });
};

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Enrich trip with scheduled identity (Key, RouteID, RouteAbbrev, SailingDay,
 * ScheduledTrip). Prediction logic is handled by the prediction facade.
 *
 * @param ctx - Convex action context for database operations
 * @param trip - Trip to enrich
 * @param cachedScheduledTrip - Optional scheduled trip from arrival lookup
 * @returns Trip with scheduled identity applied
 */
const enrichTripWithSchedule = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip,
  cachedScheduledTrip?: ConvexVesselTrip["ScheduledTrip"]
): Promise<ConvexVesselTrip> => {
  const tripStartUpdates = await enrichTripStartUpdates(
    ctx,
    trip,
    cachedScheduledTrip
  );
  return { ...trip, ...tripStartUpdates };
};

/**
 * Build tick result for trip boundary events.
 *
 * Trip boundary occurs when vessel arrives at a new terminal, completing one trip
 * and starting another. Archives the completed trip with final calculations and
 * starts a new trip with enriched data and immediate predictions.
 *
 * @param ctx - Convex action context for database operations
 * @param params.existingTrip - The trip being completed
 * @param params.currLocation - Current vessel location data
 * @returns Tick result with trip completion and new trip start
 */
const buildTripBoundaryBatch = async (
  ctx: ActionCtx,
  params: {
    existingTrip: ConvexVesselTrip;
    currLocation: ConvexVesselLocation;
  }
): Promise<VesselTripTickBatch> => {
  const { existingTrip, currLocation } = params;
  const completedPredictionRecords: ConvexPredictionRecord[] = [];

  const existingTripClean = stripConvexMeta(existingTrip) as ConvexVesselTrip;

  const completedTripBase: ConvexVesselTrip = {
    ...existingTripClean,
    TripEnd: currLocation.TimeStamp,
  };

  // AtSeaDuration: TripEnd - LeftDock
  const atSeaDuration = calculateTimeDelta(
    completedTripBase.LeftDock,
    completedTripBase.TripEnd
  );
  if (atSeaDuration !== undefined) {
    completedTripBase.AtSeaDuration = atSeaDuration;
  }

  // TotalDuration: TripEnd - TripStart
  const totalDuration = calculateTimeDelta(
    completedTripBase.TripStart,
    completedTripBase.TripEnd
  );
  if (totalDuration !== undefined) {
    completedTripBase.TotalDuration = totalDuration;
  }

  const { actualUpdates, completedRecords } = finalizeCompletedTripPredictions(
    existingTripClean,
    completedTripBase
  );
  const completedTrip: ConvexVesselTrip = {
    ...completedTripBase,
    ...actualUpdates,
  };
  completedPredictionRecords.push(...completedRecords);

  const newTrip = toConvexVesselTrip(currLocation, {
    TripStart: currLocation.TimeStamp,
    PrevTerminalAbbrev: completedTrip.DepartingTerminalAbbrev,
    PrevScheduledDeparture: completedTrip.ScheduledDeparture,
    PrevLeftDock: completedTrip.LeftDock,
  });

  // Best-effort arriving terminal inference before scheduled identity derivation.
  const arrivalLookup = await lookupArrivalTerminalFromSchedule(
    ctx,
    newTrip,
    currLocation
  );
  if (arrivalLookup?.arrivalTerminal && !newTrip.ArrivingTerminalAbbrev) {
    newTrip.ArrivingTerminalAbbrev = arrivalLookup.arrivalTerminal;
  }

  // Derive Key / ScheduledTrip snapshot and compute at-dock predictions for the
  // newly-started trip (so UI sees them on the same tick as arrival).
  const tripWithScheduled = await enrichTripWithSchedule(
    ctx,
    newTrip,
    arrivalLookup?.scheduledTripDoc
  );
  const { tripWithPredictions } = await processPredictionsForTrip(
    ctx,
    tripWithScheduled,
    undefined
  );

  const newTripWithEnrichment = tripWithPredictions;

  // Persist completion locally; do not pass up.
  await ctx.runMutation(
    api.functions.vesselTrips.mutations.completeAndStartNewTrip,
    { completedTrip, newTrip: newTripWithEnrichment }
  );

  return { activeUpsert: undefined, completedPredictionRecords };
};

/**
 * Build tick result for trip update events.
 *
 * Trip update occurs when vessel location changes within the same terminal pair.
 * Uses build-then-compare: always construct full intended state, then write only
 * if different from existing.
 *
 * @param ctx - Convex action context for database operations
 * @param params.existingTrip - Current active trip being updated
 * @param params.currLocation - Latest vessel location data
 * @returns Tick result with trip updates and optional prediction actualization
 */
const buildTripUpdateBatch = async (
  ctx: ActionCtx,
  params: {
    existingTrip: ConvexVesselTrip;
    currLocation: ConvexVesselLocation;
  }
): Promise<VesselTripTickBatch> => {
  const { existingTrip, currLocation } = params;

  // Consolidated enrichment: arrival lookup, trip building, schedule enrichment,
  // predictions, and actualization in one function.
  const result = await buildAndEnrichTrip(ctx, existingTrip, currLocation);
  const { enrichedTrip, didJustLeaveDock, predictionRecords } = result;

  const finalProposed: ConvexVesselTrip = {
    ...enrichedTrip,
    TimeStamp: currLocation.TimeStamp,
  };

  // Write only if different (build-then-compare).
  const activeUpsert = tripsAreEqual(existingTrip, finalProposed)
    ? undefined
    : finalProposed;

  if (didJustLeaveDock) {
    // Backfill depart-next actuals locally; do not pass up.
    const leftDockMs = enrichedTrip.LeftDock;
    if (leftDockMs !== undefined) {
      const result = await ctx.runMutation(
        api.functions.vesselTrips.mutations
          .setDepartNextActualsForMostRecentCompletedTrip,
        {
          vesselAbbrev: existingTrip.VesselAbbrev,
          actualDepartMs: leftDockMs,
        }
      );
      if (result?.updated === true && result?.updatedTrip !== undefined) {
        const tripData = stripConvexMeta(
          result.updatedTrip as Record<string, unknown>
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
