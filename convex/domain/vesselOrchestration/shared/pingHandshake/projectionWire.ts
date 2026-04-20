/**
 * Wire shapes for sparse `eventsActual` / `eventsPredicted` table updates per
 * orchestrator ping. Shared by trip compute and `updateTimeline` without
 * coupling the trip tree to timeline internals.
 */

import type { ConvexActualDockEvent } from "domain/events/actual/schemas";
import type { ConvexPredictedDockWriteBatch } from "domain/events/predicted/schemas";

/**
 * Sparse timeline table updates for one orchestrator ping.
 *
 * Matches `projectActualDockWrites` / `projectPredictedDockWriteBatches` args.
 */
export type PingEventWrites = {
  actualDockWrites: ConvexActualDockEvent[];
  predictedDockWriteBatches: ConvexPredictedDockWriteBatch[];
};

/**
 * Input to timeline projection after **updateVesselTrips** and
 * **updateVesselPredictions** for this ping. Structurally identical to
 * {@link PingEventWrites}.
 */
export type TimelinePingProjectionInput = PingEventWrites;

/**
 * Merges completed- then current-branch ping writes (stable ordering).
 *
 * @param completed - Writes from completed-trip transitions (first)
 * @param current - Writes from ongoing-trip updates (second)
 * @returns Combined ping writes for peers
 */
export const mergePingEventWrites = (
  completed: PingEventWrites,
  current: PingEventWrites
): PingEventWrites => ({
  actualDockWrites: [
    ...completed.actualDockWrites,
    ...current.actualDockWrites,
  ],
  predictedDockWriteBatches: [
    ...completed.predictedDockWriteBatches,
    ...current.predictedDockWriteBatches,
  ],
});
