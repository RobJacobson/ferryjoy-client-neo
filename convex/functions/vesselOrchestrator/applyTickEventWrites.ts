/**
 * Timeline overlay mutations for one orchestrator tick (updateTimeline).
 *
 * Canonical implementation for **updateTimeline** apply; import this module
 * directly when referencing the function. Production calls it from
 * {@link executeVesselOrchestratorTick} after `runProcessVesselTripsTick`.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { TimelineTickProjectionInput } from "domain/vesselOrchestration/updateVesselTrips";

/**
 * **updateTimeline** — applies per-tick `eventsActual` / `eventsPredicted` writes
 * after lifecycle persistence.
 *
 * Used by the orchestrator trip branch in {@link executeVesselOrchestratorTick}.
 *
 * @param ctx - Convex action context
 * @param writes - **updateTimeline** input (`TimelineTickProjectionInput` /
 *   `TickEventWrites`) from `tripResult.tickEventWrites`
 * @returns `undefined` after all per-tick writes settle
 */
export const applyTickEventWrites = async (
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
