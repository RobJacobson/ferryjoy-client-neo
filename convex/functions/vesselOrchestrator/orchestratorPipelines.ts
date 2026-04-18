/**
 * Named pipeline steps for one `updateVesselOrchestrator` tick: vessel locations
 * bulk upsert, trip plan/apply (with compute → locations → apply ordering),
 * predictions placeholder (O1 no-op), and timeline projection writes.
 */

import { api, internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { computeOrchestratorTripWrites } from "domain/vesselOrchestration";
import { buildTimelineTickProjectionInput } from "domain/vesselOrchestration/updateTimeline";
import { bulkUpsertArgsFromConvexLocations } from "domain/vesselOrchestration/updateVesselLocations";
import type {
  ProcessVesselTripsDeps,
  ScheduledSegmentLookup,
  TimelineTickProjectionInput,
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
 * Result of {@link updateVesselTrips}: trip apply outcome and tick anchor for
 * {@link updateVesselTimeline}.
 */
export type UpdateVesselTripsResult = {
  applyTripResult: ApplyVesselTripTickWritePlanResult;
  tickStartedAt: number;
};

/**
 * Inputs for {@link updateVesselTimeline} after {@link updateVesselTrips}.
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
 * @returns Trip apply outcome and tick anchor for timeline assembly
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
  return { applyTripResult, tickStartedAt };
};

/**
 * Orchestrator hook for **updateVesselPredictions**. O1 is a no-op: ML still runs
 * inside `buildTrip` via `applyVesselPredictions` until O3–O4 extraction.
 *
 * @param _ctx - Reserved for future prediction I/O on this tick
 */
export const updateVesselPredictions = async (
  _ctx: ActionCtx
): Promise<void> => {
  // O3–O4: predictions table + orchestrator phase; `_ctx` reserved for future I/O.
};

/**
 * Timeline projection for one tick: domain merge then `eventsActual` /
 * `eventsPredicted` mutations.
 *
 * @param ctx - Convex action context
 * @param input - Trip apply facts and tick time from {@link updateVesselTrips}
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
