import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexPredictionRecord } from "functions/predictions/schemas";
import { extractPredictionRecord } from "functions/predictions/utils";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { processVesselTripTick } from "./processVesselTripTick";

type VesselTickResult =
  | {
      ok: true;
      vesselAbbrev: string;
      batch: Awaited<ReturnType<typeof processVesselTripTick>>;
    }
  | { ok: false; vesselAbbrev: string; error: string };

type VesselTripsBatch = {
  activeUpserts: ConvexVesselTrip[];
  departNextBackfills: Array<{ vesselAbbrev: string; actualDepartMs: number }>;
  completedPredictionRecords: ConvexPredictionRecord[];
  errors: Array<{ vesselAbbrev: string; error: string }>;
};

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

  // 3) Build per-vessel tick results (build-then-compare; each may contain
  //    active upsert, completion, or depart-next backfill).
  const perVesselResults: VesselTickResult[] = await Promise.all(
    locations.map(async (currLocation) => {
      return await processVesselLocationTick(
        ctx,
        existingTripsDict,
        currLocation
      );
    })
  );

  // 4) Process completions inline (one mutation per completion; rare events).
  const completions = perVesselResults
    .filter(
      (
        r
      ): r is VesselTickResult & { ok: true; batch: { completion: object } } =>
        r.ok && r.batch.completion !== undefined
    )
    .map((r) => r.batch.completion);
  await Promise.all(
    completions.map((c) =>
      ctx.runMutation(
        api.functions.vesselTrips.mutations.completeAndStartNewTrip,
        c
      )
    )
  );

  // 5) Aggregate per-vessel results into one vessel trip batch.
  const batch = perVesselResults.reduce<VesselTripsBatch>(
    reduceToBatch,
    makeInitialBatch()
  );

  // 6) Apply vessel trip batch (active upserts + backfills only).
  const hasAnyTripWrites =
    batch.activeUpserts.length > 0 || batch.departNextBackfills.length > 0;

  let departNextUpdatedTrips: ConvexVesselTrip[] = [];
  if (hasAnyTripWrites) {
    const result = await ctx.runMutation(
      api.functions.vesselTrips.mutations.upsertVesselTripsBatch,
      {
        activeUpserts: batch.activeUpserts,
        departNextBackfills: batch.departNextBackfills,
      }
    );
    departNextUpdatedTrips = (result?.departNextUpdatedTrips ??
      []) as ConvexVesselTrip[];
  }

  // 7) Extract completed depart-next prediction rows from updated completed trips.
  const departNextPredictionRecords = departNextUpdatedTrips
    .flatMap(extractDepartNextPredictionRecords)
    .filter((value): value is ConvexPredictionRecord => value !== null);

  // 8) Combine all completed prediction rows for this tick.
  const allPredictionRecords = [
    ...batch.completedPredictionRecords,
    ...departNextPredictionRecords,
  ];

  // 9) Deduplicate by Key + PredictionType, then bulk insert.
  const uniquePredictionRecords = Array.from(
    new Map(
      allPredictionRecords.map((record) => [
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

  // Report any per-vessel failures without failing the entire tick.
  batch.errors.forEach(({ vesselAbbrev, error }) => {
    console.error(
      `[VesselTrips] Error processing vessel ${vesselAbbrev}:`,
      error
    );
  });
};

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Build tick result for a single vessel's location.
 *
 * Uses build-then-compare for regular updates: constructs full intended state,
 * compares to existing, writes only if different.
 *
 * @param ctx - Convex action context
 * @param existingTripsDict - Active trips indexed by vessel abbreviation
 * @param currLocation - Current vessel location tick
 * @returns Per-vessel tick result (active upsert, completion, or backfill)
 */
const processVesselLocationTick = async (
  ctx: ActionCtx,
  existingTripsDict: Record<string, ConvexVesselTrip>,
  currLocation: ConvexVesselLocation
): Promise<VesselTickResult> => {
  const vesselAbbrev = currLocation.VesselAbbrev;
  const existingTrip = existingTripsDict[vesselAbbrev];

  try {
    const tickBatch = await processVesselTripTick(ctx, {
      existingTrip,
      currLocation,
    });
    return { ok: true, vesselAbbrev, batch: tickBatch };
  } catch (error) {
    return {
      ok: false,
      vesselAbbrev,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Create the initial accumulator for the vessel trip batch.
 *
 * @returns Empty vessel trip batch
 */
const makeInitialBatch = (): VesselTripsBatch => ({
  activeUpserts: [],
  departNextBackfills: [],
  completedPredictionRecords: [],
  errors: [],
});

/**
 * Aggregate a per-vessel tick result into the vessel trip batch.
 *
 * @param acc - Accumulated vessel trip batch
 * @param result - Per-vessel tick result
 * @returns Updated batch
 */
const reduceToBatch = (
  acc: VesselTripsBatch,
  result: VesselTickResult
): VesselTripsBatch => {
  if (!result.ok) {
    acc.errors.push({ vesselAbbrev: result.vesselAbbrev, error: result.error });
    return acc;
  }

  const { batch: tickBatch } = result;

  if (tickBatch.activeUpsert) {
    acc.activeUpserts.push(tickBatch.activeUpsert);
  }
  if (tickBatch.departNextBackfill) {
    acc.departNextBackfills.push(tickBatch.departNextBackfill);
  }

  acc.completedPredictionRecords.push(...tickBatch.completedPredictionRecords);

  return acc;
};

/**
 * Extract depart-next prediction records (nullable) from a completed trip.
 *
 * @param trip - Completed vessel trip
 * @returns Array of potentially-null prediction records
 */
const extractDepartNextPredictionRecords = (
  trip: ConvexVesselTrip
): Array<ConvexPredictionRecord | null> => [
  extractPredictionRecord(trip, "AtDockDepartNext"),
  extractPredictionRecord(trip, "AtSeaDepartNext"),
];
