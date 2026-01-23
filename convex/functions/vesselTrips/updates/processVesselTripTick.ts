/**
 * Vessel trip update reducer.
 *
 * This file centralizes the VesselTrips update pipeline into a single-path
 * reducer that runs the same stages for every tick, emitting a write plan that
 * can be applied in bulk.
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
import { extractPredictionRecord } from "functions/predictions/utils";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import {
  type ConvexVesselTrip,
  toConvexVesselTrip,
} from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { lookupArrivalTerminalFromSchedule } from "./arrivalTerminalLookup";
import { enrichTripFields } from "./locationEnrichment";
import { enrichTripStartUpdates } from "./scheduledTripEnrichment";

type TripCompletionPlan = {
  completedTrip: ConvexVesselTrip;
  newTrip: ConvexVesselTrip;
};

type DepartNextBackfillPlan = {
  vesselAbbrev: string;
  actualDepartMs: number;
};

export type VesselTripTickPlan = {
  activeUpsert?: ConvexVesselTrip;
  completion?: TripCompletionPlan;
  departNextBackfill?: DepartNextBackfillPlan;
  completedPredictionRecords: ConvexPredictionRecord[];
};

/**
 * Process a single vessel's location tick into a write plan.
 *
 * The returned plan is intended to be applied later in a batch mutation.
 *
 * @param ctx - Convex action context
 * @param params.existingTrip - Existing active trip (if any)
 * @param params.currLocation - Current vessel location tick
 * @param params.nowMs - Single tick time reference in epoch ms
 * @returns Plan containing optional trip writes and completed prediction records
 */
export const processVesselTripTick = async (
  ctx: ActionCtx,
  params: {
    existingTrip: ConvexVesselTrip | undefined;
    currLocation: ConvexVesselLocation;
  }
): Promise<VesselTripTickPlan> => {
  const { existingTrip, currLocation } = params;

  const completedPredictionRecords: ConvexPredictionRecord[] = [];

  // ============================================================================
  // Stage 0: identify event type
  // ============================================================================
  if (!existingTrip) {
    const newTrip = toConvexVesselTrip(currLocation, {});
    return finalizePlan({
      activeUpsert: newTrip,
      completion: undefined,
      departNextBackfill: undefined,
      completedPredictionRecords,
    });
  }

  const isTripBoundary =
    existingTrip.DepartingTerminalAbbrev !==
    currLocation.DepartingTerminalAbbrev;

  if (isTripBoundary) {
    return await buildTripBoundaryPlan(ctx, {
      existingTrip,
      currLocation,
    });
  }

  return await buildTripUpdatePlan(ctx, {
    existingTrip,
    currLocation,
  });
};

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Build a write plan for trip boundary events.
 *
 * Trip boundary occurs when vessel arrives at a new terminal, completing one trip
 * and starting another. Archives the completed trip with final calculations and
 * starts a new trip with enriched data and immediate predictions.
 *
 * @param ctx - Convex action context for database operations
 * @param params.existingTrip - The trip being completed
 * @param params.currLocation - Current vessel location data
 * @returns Write plan with trip completion and new trip start
 */
const buildTripBoundaryPlan = async (
  ctx: ActionCtx,
  params: {
    existingTrip: ConvexVesselTrip;
    currLocation: ConvexVesselLocation;
  }
): Promise<VesselTripTickPlan> => {
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
  const lookedUpArrivalTerminal = await lookupArrivalTerminalFromSchedule(
    ctx,
    newTrip,
    currLocation
  );
  if (lookedUpArrivalTerminal && !newTrip.ArrivingTerminalAbbrev) {
    newTrip.ArrivingTerminalAbbrev = lookedUpArrivalTerminal;
  }

  // Immediately derive Key / ScheduledTrip snapshot and compute at-dock predictions
  // for the newly-started trip (so UI sees them on the same tick as arrival).
  const tripStartUpdates = await enrichTripStartUpdates(ctx, newTrip);
  const tripForPredictions: ConvexVesselTrip = {
    ...newTrip,
    ...tripStartUpdates,
  };
  const predictionUpdates = await computeVesselTripPredictionsPatch(
    ctx,
    tripForPredictions,
    undefined
  );

  const newTripWithEnrichment: ConvexVesselTrip = {
    ...newTrip,
    ...tripStartUpdates,
    ...predictionUpdates,
  };

  return finalizePlan({
    activeUpsert: undefined,
    completion: { completedTrip, newTrip: newTripWithEnrichment },
    departNextBackfill: undefined,
    completedPredictionRecords,
  });
};

/**
 * Build a write plan for trip update events.
 *
 * Trip update occurs when vessel location changes within the same terminal pair.
 * Updates trip fields, enriches with scheduled data, computes predictions with
 * throttling, and handles departure events that actualize predictions.
 *
 * @param ctx - Convex action context for database operations
 * @param params.existingTrip - Current active trip being updated
 * @param params.currLocation - Latest vessel location data
 * @returns Write plan with trip updates and optional prediction actualization
 */
const buildTripUpdatePlan = async (
  ctx: ActionCtx,
  params: {
    existingTrip: ConvexVesselTrip;
    currLocation: ConvexVesselLocation;
  }
): Promise<VesselTripTickPlan> => {
  const { existingTrip, currLocation } = params;
  const completedPredictionRecords: ConvexPredictionRecord[] = [];

  // 1) Location-derived patch.
  const tripFieldUpdates = enrichTripFields(existingTrip, currLocation);
  const baseTrip: ConvexVesselTrip = {
    ...existingTrip,
    ...tripFieldUpdates,
  };

  // Best-effort arriving terminal inference before scheduled identity derivation.
  const lookedUpArrivalTerminal = await lookupArrivalTerminalFromSchedule(
    ctx,
    baseTrip,
    currLocation
  );
  const arrivingTerminalPatch: Partial<ConvexVesselTrip> = {
    ...(lookedUpArrivalTerminal && !baseTrip.ArrivingTerminalAbbrev
      ? { ArrivingTerminalAbbrev: lookedUpArrivalTerminal }
      : {}),
  };

  const forTripIdentity: ConvexVesselTrip = {
    ...baseTrip,
    ...arrivingTerminalPatch,
  };

  // 2) Scheduled identity + snapshot.
  const tripStartUpdates = await enrichTripStartUpdates(ctx, forTripIdentity);

  // 3) Predictions (throttled).
  const tripForPredictions: ConvexVesselTrip = {
    ...forTripIdentity,
    ...tripStartUpdates,
  };
  const predictionUpdates = await computeVesselTripPredictionsPatch(
    ctx,
    tripForPredictions,
    existingTrip
  );

  // 4) Actualize predictions from events observable on the same trip.
  const didJustLeaveDock = !existingTrip.LeftDock && baseTrip.LeftDock;
  const actualUpdates = didJustLeaveDock
    ? updatePredictionsWithActuals(existingTrip, {
        ...tripForPredictions,
        ...predictionUpdates,
      })
    : {};

  const updatedData: Partial<ConvexVesselTrip> = {
    ...tripFieldUpdates,
    ...arrivingTerminalPatch,
    ...tripStartUpdates,
    ...predictionUpdates,
    ...actualUpdates,
  };

  const hasAnyUpdates = Object.keys(updatedData).length > 0;

  const activeUpsert = hasAnyUpdates
    ? ({
        ...existingTrip,
        ...updatedData,
        TimeStamp: currLocation.TimeStamp,
      } satisfies ConvexVesselTrip)
    : undefined;

  if (didJustLeaveDock && baseTrip.LeftDock) {
    // Insert completed AtDockDepartCurr prediction record (current trip).
    if (activeUpsert) {
      const record = extractPredictionRecord(activeUpsert, "AtDockDepartCurr");
      if (record) {
        completedPredictionRecords.push(record);
      }
    }
  }

  return finalizePlan({
    activeUpsert,
    completion: undefined,
    departNextBackfill:
      didJustLeaveDock && baseTrip.LeftDock
        ? {
            vesselAbbrev: existingTrip.VesselAbbrev,
            actualDepartMs: baseTrip.LeftDock,
          }
        : undefined,
    completedPredictionRecords,
  });
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
  const fields = [
    "AtDockDepartCurr",
    "AtDockArriveNext",
    "AtDockDepartNext",
    "AtSeaArriveNext",
    "AtSeaDepartNext",
  ] as const;

  const records: ConvexPredictionRecord[] = [];
  for (const field of fields) {
    const record = extractPredictionRecord(trip, field);
    if (record) {
      records.push(record);
    }
  }
  return records;
};

/**
 * Finalize a vessel trip tick plan with computed statistics.
 *
 * Ensures the plan has consistent statistics and completed prediction records
 * count. This is the final step before returning the plan for execution.
 *
 * @param plan - Partially built vessel trip tick plan
 * @returns Complete vessel trip tick plan with final statistics
 */
const finalizePlan = (plan: VesselTripTickPlan): VesselTripTickPlan => {
  return {
    ...plan,
    completedPredictionRecords: plan.completedPredictionRecords,
  };
};
