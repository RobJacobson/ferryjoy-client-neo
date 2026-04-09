/**
 * Applies per-tick timeline table writes produced after lifecycle persistence.
 *
 * Peers run this after `processVesselTrips` so `eventsActual` / `eventsPredicted`
 * stay aligned with durable trip rows.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { TickEventWrites } from "functions/vesselTrips/updates/processTick/tickEventWrites";

/**
 * Persists sparse `eventsActual` patches and `eventsPredicted` effects for one tick.
 *
 * @param ctx - Convex action context
 * @param writes - Combined patches and effects from the tick assembler
 * @returns Promise that resolves when both mutations finish (or no-op)
 */
export const applyTickEventWrites = async (
  ctx: ActionCtx,
  writes: TickEventWrites
): Promise<void> => {
  await Promise.all([
    writes.actualPatches.length > 0
      ? ctx.runMutation(
          internal.functions.eventsActual.mutations
            .projectActualBoundaryPatches,
          {
            Patches: writes.actualPatches,
          }
        )
      : Promise.resolve(),
    writes.predictedEffects.length > 0
      ? ctx.runMutation(
          internal.functions.eventsPredicted.mutations
            .projectPredictedBoundaryEffects,
          {
            Effects: writes.predictedEffects,
          }
        )
      : Promise.resolve(),
  ]);
};
