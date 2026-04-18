/**
 * Named pipeline steps for one `updateVesselOrchestrator` tick: vessel locations
 * bulk upsert, trip plan/apply (with compute → locations → apply ordering),
 * ML merge + `vesselTripPredictions` upserts, and timeline projection writes.
 */

import { api, internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import { computeOrchestratorTripWrites } from "domain/vesselOrchestration";
import { buildTimelineTickProjectionInput } from "domain/vesselOrchestration/updateTimeline";
import { bulkUpsertArgsFromConvexLocations } from "domain/vesselOrchestration/updateVesselLocations";
import type {
  ProcessVesselTripsDeps,
  ScheduledSegmentLookup,
  TimelineTickProjectionInput,
  VesselTripTickWritePlan,
} from "domain/vesselOrchestration/updateVesselTrips";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import {
  type ApplyVesselTripTickWritePlanResult,
  applyVesselTripTickWritePlan,
} from "functions/vesselTrips/applyVesselTripTickWritePlan";
import type {
  ConvexVesselTripWithPredictions,
  TickActiveTrip,
} from "functions/vesselTrips/schemas";

import { enrichTripApplyResultWithPredictions } from "./enrichTripApplyResultWithPredictions";

/**
 * Inputs for {@link updateVesselTrips}: same locations and trips as
 * {@link computeOrchestratorTripWrites}, plus trip dependency wiring.
 */
export type UpdateVesselTripsInput = {
  convexLocations: ReadonlyArray<ConvexVesselLocation>;
  activeTrips: ReadonlyArray<TickActiveTrip | ConvexVesselTripWithPredictions>;
  tripDeps: ProcessVesselTripsDeps;
};

/**
 * Result of {@link updateVesselTrips}: trip apply outcome, original write plan
 * (for diagnostics), and tick anchor for {@link updateVesselPredictions} /
 * {@link updateVesselTimeline}.
 */
export type UpdateVesselTripsResult = {
  applyTripResult: ApplyVesselTripTickWritePlanResult;
  tripWrites: VesselTripTickWritePlan;
  tickStartedAt: number;
};

/**
 * Inputs for {@link updateVesselTimeline} after {@link updateVesselPredictions}
 * (ML-enriched {@link ApplyVesselTripTickWritePlanResult}).
 */
export type UpdateVesselTimelineInput = {
  applyTripResult: ApplyVesselTripTickWritePlanResult;
  tickStartedAt: number;
};

/**
 * Schedule lookup backed by internal `eventsScheduled` queries for vessel trip
 * ticks (`createDefaultProcessVesselTripsDeps`).
 *
 * @param ctx - Convex action context for query execution
 * @returns Lookup callbacks for scheduled departure and dock events
 */
export const createScheduledSegmentLookup = (
  ctx: ActionCtx
): ScheduledSegmentLookup => ({
  getScheduledDepartureEventBySegmentKey: (segmentKey: string) =>
    ctx.runQuery(
      internal.functions.events.eventsScheduled.queries
        .getScheduledDepartureEventBySegmentKey,
      { segmentKey }
    ),
  getScheduledDockEventsForSailingDay: (args: {
    vesselAbbrev: string;
    sailingDay: string;
  }) =>
    ctx.runQuery(
      internal.functions.events.eventsScheduled.queries
        .getScheduledDockEventsForSailingDay,
      args
    ),
});

/**
 * Persists live vessel positions for one tick via `vesselLocations` bulk upsert.
 *
 * @param ctx - Convex action context
 * @param convexLocations - Converted WSF batch for this tick
 */
export const updateVesselLocations = async (
  ctx: ActionCtx,
  convexLocations: ReadonlyArray<ConvexVesselLocation>
): Promise<void> => {
  await ctx.runMutation(
    api.functions.vesselLocation.mutations.bulkUpsert,
    bulkUpsertArgsFromConvexLocations(convexLocations)
  );
};

/**
 * Computes the trip write plan, upserts live locations, then applies lifecycle
 * mutations. **Ordering:** `computeOrchestratorTripWrites` →
 * {@link updateVesselLocations} → {@link applyVesselTripTickWritePlan} — matches
 * the orchestrator invariant (plan before location upsert before trip apply).
 *
 * @param ctx - Convex action context
 * @param input - Locations, active trips, and `ProcessVesselTripsDeps`
 * @returns Trip apply outcome, the tick write plan (for diagnostics), and tick
 *   anchor for {@link updateVesselPredictions} / {@link updateVesselTimeline}
 */
export const updateVesselTrips = async (
  ctx: ActionCtx,
  input: UpdateVesselTripsInput
): Promise<UpdateVesselTripsResult> => {
  const { convexLocations, activeTrips, tripDeps } = input;
  const { tripWrites, tickStartedAt } = await computeOrchestratorTripWrites(
    { convexLocations, activeTrips },
    tripDeps
  );
  await updateVesselLocations(ctx, convexLocations);
  const applyTripResult = await applyVesselTripTickWritePlan(ctx, tripWrites);
  return { applyTripResult, tripWrites, tickStartedAt };
};

/**
 * Inputs for {@link updateVesselPredictions} after {@link updateVesselTrips}.
 */
export type UpdateVesselPredictionsInput = {
  applyTripResult: ApplyVesselTripTickWritePlanResult;
  predictionModelAccess: VesselTripPredictionModelAccess;
};

/**
 * Runs `applyVesselPredictions`, merges ML onto lifecycle outputs for timeline,
 * then persists `vesselTripPredictions` rows. **Ordering:** in-memory ML merge
 * completes before return (timeline must not read DB predictions from this tick);
 * `batchUpsertProposals` runs after merge.
 *
 * @param ctx - Convex action context
 * @param input - Post-apply lifecycle state and ML model access
 * @returns ML-enriched apply result for {@link updateVesselTimeline}
 */
export const updateVesselPredictions = async (
  ctx: ActionCtx,
  input: UpdateVesselPredictionsInput
): Promise<ApplyVesselTripTickWritePlanResult> =>
  enrichTripApplyResultWithPredictions(
    ctx,
    input.applyTripResult,
    input.predictionModelAccess
  );

/**
 * Timeline projection for one tick: domain merge then `eventsActual` /
 * `eventsPredicted` mutations.
 *
 * @param ctx - Convex action context
 * @param input - Trip apply facts (typically ML-enriched by
 *   {@link updateVesselPredictions}) and tick time
 * @see {@link buildTimelineTickProjectionInput} — domain merge of apply result slices
 */
export const updateVesselTimeline = async (
  ctx: ActionCtx,
  input: UpdateVesselTimelineInput
): Promise<void> => {
  const timelineWrites = buildTimelineTickProjectionInput({
    completedFacts: input.applyTripResult.completedFacts,
    currentBranch: input.applyTripResult.currentBranch,
    tickStartedAt: input.tickStartedAt,
  });
  await applyTimelineTickProjectionWrites(ctx, timelineWrites);
};

/**
 * Applies sparse `eventsActual` / `eventsPredicted` writes for one tick.
 *
 * @param ctx - Convex action context
 * @param writes - Timeline projection payload from domain assembly
 */
const applyTimelineTickProjectionWrites = async (
  ctx: ActionCtx,
  writes: TimelineTickProjectionInput
): Promise<void> => {
  await Promise.all([
    writes.actualDockWrites.length > 0
      ? ctx.runMutation(
          internal.functions.events.eventsActual.mutations
            .projectActualDockWrites,
          {
            Writes: writes.actualDockWrites,
          }
        )
      : Promise.resolve(),
    writes.predictedDockWriteBatches.length > 0
      ? ctx.runMutation(
          internal.functions.events.eventsPredicted.mutations
            .projectPredictedDockWriteBatches,
          {
            Batches: writes.predictedDockWriteBatches,
          }
        )
      : Promise.resolve(),
  ]);
};
