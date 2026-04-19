/**
 * Per-tick writes for timeline tables (`eventsActual`, `eventsPredicted`) produced
 * after lifecycle persistence. Peers apply these via orchestrator mutations.
 */

import type { ConvexActualDockEvent } from "domain/events/actual/schemas";
import type { ConvexPredictedDockWriteBatch } from "domain/events/predicted/schemas";

/**
 * Sparse timeline table updates for one orchestrator tick.
 *
 * Matches `projectActualDockWrites` / `projectPredictedDockWriteBatches` args.
 */
export type TickEventWrites = {
  actualDockWrites: ConvexActualDockEvent[];
  predictedDockWriteBatches: ConvexPredictedDockWriteBatch[];
};

/**
 * Input to **updateTimeline** (timeline projection step in
 * `updateVesselOrchestrator`). Produced after **updateVesselTrips** and
 * **updateVesselPredictions** for this tick. Structurally identical
 * to {@link TickEventWrites}.
 */
export type TimelineTickProjectionInput = TickEventWrites;

/**
 * Merges completed- then current-branch tick writes (stable ordering).
 *
 * @param completed - Writes from completed-trip transitions (first)
 * @param current - Writes from ongoing-trip updates (second)
 * @returns Combined tick writes for peers
 */
export const mergeTickEventWrites = (
  completed: TickEventWrites,
  current: TickEventWrites
): TickEventWrites => ({
  actualDockWrites: [
    ...completed.actualDockWrites,
    ...current.actualDockWrites,
  ],
  predictedDockWriteBatches: [
    ...completed.predictedDockWriteBatches,
    ...current.predictedDockWriteBatches,
  ],
});
