/**
 * Vessel trip tick processor (build-then-compare pipeline).
 *
 * For each tick, builds the full intended trip state, compares to existing,
 * and emits a vessel trip batch for only what changed. Regular updates use deep
 * equality to skip writes when semantic state is unchanged.
 *
 * Invariants and event conditions:
 * - One active trip per vessel (keyed by `VesselAbbrev`) in `activeVesselTrips`.
 * - `firstTrip`: no existing active trip for `VesselAbbrev` → create active.
 * - `tripBoundary`: `DepartingTerminalAbbrev` changes between active trip and
 *   current location → complete existing trip and start a new one.
 * - `didJustLeaveDock`: `LeftDock` transitions from undefined → defined on the
 *   current active trip (typically driven by `AtDock` flipping true→false).
 *   This triggers two side effects:
 *   1) Backfill depart-next actuals onto the *previous* completed trip.
 *   2) Actualize `AtDockDepartCurr` on the *current* active trip.
 */
import type { ActionCtx } from "_generated/server";
import {
  computeVesselTripPredictionsPatch,
  updatePredictionsWithActuals,
} from "domain/ml/prediction";
import type { ConvexPredictionRecord } from "functions/predictions/schemas";
import {
  extractPredictionRecord,
  PREDICTION_FIELDS,
} from "functions/predictions/utils";
import type { ConvexScheduledTrip } from "functions/scheduledTrips/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import {
  type ConvexVesselTrip,
  toConvexVesselTrip,
} from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { lookupArrivalTerminalFromSchedule } from "./arrivalTerminalLookup";
import { buildCompleteTrip } from "./buildCompleteTrip";
import { enrichTripStartUpdates } from "./scheduledTripEnrichment";
import { tripsAreEqual } from "./tripEquality";

type TripCompletionBatch = {
  completedTrip: ConvexVesselTrip;
  newTrip: ConvexVesselTrip;
};

type DepartNextBackfillBatch = {
  vesselAbbrev: string;
  actualDepartMs: number;
};

export type VesselTripTickBatch = {
  activeUpsert?: ConvexVesselTrip;
  completion?: TripCompletionBatch;
  departNextBackfill?: DepartNextBackfillBatch;
  completedPredictionRecords: ConvexPredictionRecord[];
};

/**
 * Build tick result for a single vessel's location.
 *
 * Uses build-then-compare for regular updates: constructs full intended state,
 * deep-compares to existing, writes only if different. Boundary and first-trip
 * paths always produce writes.
 *
 * @param ctx - Convex action context
 * @param params.existingTrip - Existing active trip (if any)
 * @param params.currLocation - Current vessel location tick
 * @returns Tick result (active upsert, completion, backfill, prediction records)
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
    return {
      activeUpsert: newTrip,
      completion: undefined,
      departNextBackfill: undefined,
      completedPredictionRecords,
    };
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
 * Enrich trip with scheduled identity (Key, RouteID, etc.) and ML predictions.
 * Shared by boundary and update paths to avoid duplication.
 *
 * @param ctx - Convex action context for database operations
 * @param trip - Trip to enrich
 * @param existingTrip - Previous trip state (for event-based prediction triggers)
 * @param cachedScheduledTrip - Optional scheduled trip from arrival lookup
 * @returns Enriched trip and prediction updates
 */
const enrichTripWithScheduleAndPredictions = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip,
  existingTrip: ConvexVesselTrip | undefined,
  cachedScheduledTrip?: ConvexScheduledTrip
): Promise<{
  tripWithScheduled: ConvexVesselTrip;
  predictionUpdates: Partial<ConvexVesselTrip>;
}> => {
  const tripStartUpdates = await enrichTripStartUpdates(
    ctx,
    trip,
    cachedScheduledTrip
  );
  const tripWithScheduled = { ...trip, ...tripStartUpdates };
  const predictionUpdates = await computeVesselTripPredictionsPatch(
    ctx,
    tripWithScheduled,
    existingTrip
  );
  return { tripWithScheduled, predictionUpdates };
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

  const completedTrip: ConvexVesselTrip = {
    ...completedTripBase,
    ...updatePredictionsWithActuals(existingTripClean, completedTripBase),
  };

  completedPredictionRecords.push(
    ...extractCompletedPredictionRecords(completedTrip)
  );

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

  // Immediately derive Key / ScheduledTrip snapshot and compute at-dock predictions
  // for the newly-started trip (so UI sees them on the same tick as arrival).
  const { tripWithScheduled, predictionUpdates } =
    await enrichTripWithScheduleAndPredictions(
      ctx,
      newTrip,
      undefined,
      arrivalLookup?.scheduledTripDoc
    );

  const newTripWithEnrichment: ConvexVesselTrip = {
    ...tripWithScheduled,
    ...predictionUpdates,
  };

  return {
    activeUpsert: undefined,
    completion: { completedTrip, newTrip: newTripWithEnrichment },
    departNextBackfill: undefined,
    completedPredictionRecords,
  };
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
  const completedPredictionRecords: ConvexPredictionRecord[] = [];

  // 1) Base trip for lookup: include latest ScheduledDeparture for arrival lookup.
  const baseTripForLookup: ConvexVesselTrip = {
    ...existingTrip,
    ScheduledDeparture:
      currLocation.ScheduledDeparture ?? existingTrip.ScheduledDeparture,
  };

  // 2) Arrival lookup (I/O-conditioned; only when at dock + missing ArrivingTerminal).
  const arrivalLookup = await lookupArrivalTerminalFromSchedule(
    ctx,
    baseTripForLookup,
    currLocation
  );

  // 3) Build complete trip from location + enrichment.
  const proposedTrip = buildCompleteTrip(
    existingTrip,
    currLocation,
    arrivalLookup
  );

  // 4) Scheduled identity + snapshot and predictions.
  const { tripWithScheduled, predictionUpdates } =
    await enrichTripWithScheduleAndPredictions(
      ctx,
      proposedTrip,
      existingTrip,
      arrivalLookup?.scheduledTripDoc
    );

  // 5) Actualize predictions when vessel just left dock.
  const didJustLeaveDock =
    !existingTrip.LeftDock && tripWithScheduled.LeftDock !== undefined;
  const actualUpdates = didJustLeaveDock
    ? updatePredictionsWithActuals(existingTrip, {
        ...tripWithScheduled,
        ...predictionUpdates,
      })
    : {};

  const finalProposed: ConvexVesselTrip = {
    ...tripWithScheduled,
    ...predictionUpdates,
    ...actualUpdates,
    TimeStamp: currLocation.TimeStamp,
  };

  // 6) Write only if different (build-then-compare).
  const activeUpsert = tripsAreEqual(existingTrip, finalProposed)
    ? undefined
    : finalProposed;

  if (didJustLeaveDock) {
    if (activeUpsert) {
      const record = extractPredictionRecord(activeUpsert, "AtDockDepartCurr");
      if (record) {
        completedPredictionRecords.push(record);
      }
    }
  }

  const leftDockMs = tripWithScheduled.LeftDock;
  return {
    activeUpsert,
    completion: undefined,
    departNextBackfill:
      didJustLeaveDock && leftDockMs !== undefined
        ? {
            vesselAbbrev: existingTrip.VesselAbbrev,
            actualDepartMs: leftDockMs,
          }
        : undefined,
    completedPredictionRecords,
  };
};

/**
 * Extract all completed prediction records from a vessel trip.
 *
 * Converts prediction fields that have actual outcomes into database records
 * for storage and analysis. Only includes predictions that have been actualized
 * with real observed timestamps.
 *
 * @param trip - Vessel trip containing predictions to extract
 * @returns Array of prediction records ready for database insertion
 */
const extractCompletedPredictionRecords = (
  trip: ConvexVesselTrip
): ConvexPredictionRecord[] => {
  const records: ConvexPredictionRecord[] = [];
  for (const field of PREDICTION_FIELDS) {
    const record = extractPredictionRecord(trip, field);
    if (record) {
      records.push(record);
    }
  }
  return records;
};
