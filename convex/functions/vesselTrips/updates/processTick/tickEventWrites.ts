/**
 * Per-tick writes for timeline tables (`eventsActual`, `eventsPredicted`) produced
 * after lifecycle persistence. Peers apply these via orchestrator mutations.
 */

import type { ConvexActualBoundaryPatch } from "functions/eventsActual/schemas";
import type { ConvexPredictedBoundaryProjectionEffect } from "functions/eventsPredicted/schemas";

/**
 * Sparse timeline table updates for one orchestrator tick.
 *
 * Matches `projectActualBoundaryPatches` / `projectPredictedBoundaryEffects` args.
 */
export type TickEventWrites = {
  actualPatches: ConvexActualBoundaryPatch[];
  predictedEffects: ConvexPredictedBoundaryProjectionEffect[];
};

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
  actualPatches: [...completed.actualPatches, ...current.actualPatches],
  predictedEffects: [
    ...completed.predictedEffects,
    ...current.predictedEffects,
  ],
});
