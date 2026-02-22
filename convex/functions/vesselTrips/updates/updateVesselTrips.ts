import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexPredictionRecord } from "functions/predictions/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { processVesselTripTick } from "./processVesselTripTick";

/**
 * Main orchestration for updating active vessel trips.
 *
 * Processes vessel locations and active trips to handle trip lifecycle events
 * (first trips, boundaries, regular updates). Uses build-then-compare for
 * regular updates: constructs full intended state, writes only if different.
 *
 * @param ctx - Convex action context for database operations
 * @param locations - Array of vessel locations to process (already converted and deduplicated)
 */
export const runUpdateVesselTrips = async (
  ctx: ActionCtx,
  locations: ConvexVesselLocation[]
): Promise<void> => {
  // 1) Load current active trips once (for O(1) per-vessel lookup).
  const existingTripsList = (
    await ctx.runQuery(api.functions.vesselTrips.queries.getActiveTrips)
  ).map(
    (doc) => stripConvexMeta(doc as Record<string, unknown>) as ConvexVesselTrip
  );

  // 2) Index active trips by vessel abbreviation.
  const existingTripsDict = Object.fromEntries(
    existingTripsList.map((trip) => [trip.VesselAbbrev, trip] as const)
  ) as Record<string, ConvexVesselTrip>;

  // 3) Build per-vessel tick results. Completions and depart-next backfills
  //    are handled locally in processVesselTripTick where detected.
  const results = await Promise.all(
    locations.map((currLocation) =>
      processVesselLocationTick(ctx, existingTripsDict, currLocation)
    )
  );

  const activeUpserts = results.flatMap((r) =>
    r.activeUpsert ? [r.activeUpsert] : []
  );
  const completedPredictionRecords = results.flatMap(
    (r) => r.completedPredictionRecords
  );

  // 4) Apply vessel trip batch (active upserts only).
  if (activeUpserts.length > 0) {
    await ctx.runMutation(
      api.functions.vesselTrips.mutations.upsertVesselTripsBatch,
      { activeUpserts }
    );
  }

  // 5) Deduplicate prediction records by Key + PredictionType, then bulk insert.
  const uniquePredictionRecords = Array.from(
    new Map(
      completedPredictionRecords.map((record) => [
        `${record.Key}:${record.PredictionType}`,
        record,
      ])
    ).values()
  );

  if (uniquePredictionRecords.length > 0) {
    await ctx.runMutation(
      api.functions.predictions.mutations.bulkInsertPredictions,
      {
        predictions: uniquePredictionRecords,
      }
    );
  }
};

// ============================================================================
// Internal helpers
// ============================================================================

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
const processVesselLocationTick = async (
  ctx: ActionCtx,
  existingTripsDict: Record<string, ConvexVesselTrip>,
  currLocation: ConvexVesselLocation
): Promise<{
  activeUpsert?: ConvexVesselTrip;
  completedPredictionRecords: ConvexPredictionRecord[];
}> => {
  const vesselAbbrev = currLocation.VesselAbbrev;
  const existingTrip = existingTripsDict[vesselAbbrev];

  try {
    return await processVesselTripTick(ctx, {
      existingTrip,
      currLocation,
    });
  } catch (error) {
    console.error(
      `[VesselTrips] Error processing vessel ${vesselAbbrev}:`,
      error instanceof Error ? error.message : String(error)
    );
    return { activeUpsert: undefined, completedPredictionRecords: [] };
  }
};
