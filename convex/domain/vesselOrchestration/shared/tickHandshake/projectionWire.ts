/**
 * Wire shapes for sparse `eventsActual` / `eventsPredicted` table updates per
 * orchestrator tick. Shared by trip compute and `updateTimeline` without
 * coupling the trip tree to timeline internals.
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
 * Input to timeline projection after **updateVesselTrips** and
 * **updateVesselPredictions** for this tick. Structurally identical to
 * {@link TickEventWrites}.
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
