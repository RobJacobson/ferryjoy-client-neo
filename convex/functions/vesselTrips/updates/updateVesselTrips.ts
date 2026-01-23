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
      plan: Awaited<ReturnType<typeof processVesselTripTick>>;
    }
  | { ok: false; vesselAbbrev: string; error: string };

type VesselTripsWritePlan = {
  activeUpserts: ConvexVesselTrip[];
  completions: Array<{
    completedTrip: ConvexVesselTrip;
    newTrip: ConvexVesselTrip;
  }>;
  departNextBackfills: Array<{ vesselAbbrev: string; actualDepartMs: number }>;
  completedPredictionRecords: ConvexPredictionRecord[];
  errors: Array<{ vesselAbbrev: string; error: string }>;
  stats: { firstTrip: number; tripBoundary: number; tripUpdate: number };
};

/**
 * Main orchestration function for updating active vessel trips.
 *
 * Processes vessel locations and active trips to handle trip lifecycle events
 * (first trips, new trips, trip updates). Manages trip enrichment, prediction
 * generation, and database persistence.
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

  // 3) Compute per-vessel update plans (best-effort per vessel).
  const perVesselResults: VesselTickResult[] = await Promise.all(
    locations.map(async (currLocation) => {
      return await processVesselLocationTick(
        ctx,
        existingTripsDict,
        currLocation
      );
    })
  );

  // 4) Reduce per-vessel plans into one batched write plan.
  const writePlan = perVesselResults.reduce<VesselTripsWritePlan>(
    reduceToWritePlan,
    makeInitialWritePlan()
  );

  // 5) Apply trip writes in a single batch mutation.
  const hasAnyTripWrites =
    writePlan.activeUpserts.length > 0 ||
    writePlan.completions.length > 0 ||
    writePlan.departNextBackfills.length > 0;

  let departNextUpdatedTrips: ConvexVesselTrip[] = [];
  if (hasAnyTripWrites) {
    const result = await ctx.runMutation(
      api.functions.vesselTrips.mutations.applyVesselTripsWritePlan,
      {
        activeUpserts: writePlan.activeUpserts,
        completions: writePlan.completions,
        departNextBackfills: writePlan.departNextBackfills,
      }
    );
    departNextUpdatedTrips = (result?.departNextUpdatedTrips ??
      []) as ConvexVesselTrip[];
  }

  // 6) Extract completed depart-next prediction rows from updated completed trips.
  const departNextPredictionRecords = departNextUpdatedTrips
    .flatMap(extractDepartNextPredictionRecords)
    .filter((value): value is ConvexPredictionRecord => value !== null);

  // 7) Combine all completed prediction rows for this tick.
  const allPredictionRecords = [
    ...writePlan.completedPredictionRecords,
    ...departNextPredictionRecords,
  ];

  // 8) Deduplicate by Key + PredictionType, then bulk insert.
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

  // 9) Report any per-vessel failures without failing the entire tick.
  if (writePlan.errors.length > 0) {
    console.warn("[VesselTrips] per-vessel errors:", writePlan.errors);
  }

  // 10) Log a lightweight tick summary for observability.
  console.log("[VesselTrips] tick summary:", {
    vessels: locations.length,
    firstTripCount: writePlan.stats.firstTrip,
    tripBoundaryCount: writePlan.stats.tripBoundary,
    tripUpdateCount: writePlan.stats.tripUpdate,
    activeUpserts: writePlan.activeUpserts.length,
    completions: writePlan.completions.length,
    departNextBackfills: writePlan.departNextBackfills.length,
    completedPredictionRecords: allPredictionRecords.length,
    uniquePredictionRecords: uniquePredictionRecords.length,
    errors: writePlan.errors.length,
  });
};

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Process a single vessel location tick into a per-vessel plan result.
 *
 * @param ctx - Convex action context
 * @param existingTripsDict - Active trips indexed by vessel abbreviation
 * @param nowMs - Single tick time reference in epoch ms
 * @param currLocation - Current vessel location tick
 * @returns Best-effort per-vessel plan result
 */
const processVesselLocationTick = async (
  ctx: ActionCtx,
  existingTripsDict: Record<string, ConvexVesselTrip>,
  currLocation: ConvexVesselLocation
): Promise<VesselTickResult> => {
  const vesselAbbrev = currLocation.VesselAbbrev;
  const existingTrip = existingTripsDict[vesselAbbrev];

  try {
    const plan = await processVesselTripTick(ctx, {
      existingTrip,
      currLocation,
    });
    return { ok: true, vesselAbbrev, plan };
  } catch (error) {
    return {
      ok: false,
      vesselAbbrev,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Create the initial accumulator for a tick write plan.
 *
 * @returns Empty write plan accumulator
 */
const makeInitialWritePlan = (): VesselTripsWritePlan => ({
  activeUpserts: [],
  completions: [],
  departNextBackfills: [],
  completedPredictionRecords: [],
  errors: [],
  stats: { firstTrip: 0, tripBoundary: 0, tripUpdate: 0 },
});

/**
 * Reduce a per-vessel result into the tick write plan accumulator.
 *
 * @param acc - Accumulated write plan
 * @param result - Per-vessel processing result
 * @returns Updated accumulator
 */
const reduceToWritePlan = (
  acc: VesselTripsWritePlan,
  result: VesselTickResult
): VesselTripsWritePlan => {
  if (!result.ok) {
    acc.errors.push({ vesselAbbrev: result.vesselAbbrev, error: result.error });
    return acc;
  }

  const { plan } = result;

  if (plan.activeUpsert) {
    acc.activeUpserts.push(plan.activeUpsert);
  }
  if (plan.completion) {
    acc.completions.push(plan.completion);
  }
  if (plan.departNextBackfill) {
    acc.departNextBackfills.push(plan.departNextBackfill);
  }

  acc.completedPredictionRecords.push(...plan.completedPredictionRecords);

  if (plan.stats.event === "firstTrip") acc.stats.firstTrip += 1;
  if (plan.stats.event === "tripBoundary") acc.stats.tripBoundary += 1;
  if (plan.stats.event === "tripUpdate") acc.stats.tripUpdate += 1;

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
