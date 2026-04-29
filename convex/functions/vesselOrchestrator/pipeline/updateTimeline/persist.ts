/**
 * Persists timeline rows for one vessel branch.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexPredictedDockWriteBatch } from "functions/events/eventsPredicted/schemas";

/**
 * Applies actual timeline writes when rows exist.
 *
 * @param ctx - Convex mutation context for timeline persistence calls
 * @param actualEvents - Sparse actual timeline rows
 */
export const persistActualTimelineEvents = async (
  ctx: ActionCtx,
  actualEvents: ReadonlyArray<ConvexActualDockEvent>
): Promise<void> => {
  if (actualEvents.length > 0) {
    await ctx.runMutation(
      internal.functions.events.eventsActual.mutations.projectActualDockWrites,
      { Writes: Array.from(actualEvents) }
    );
  }
};

/**
 * Applies predicted timeline writes when rows exist.
 *
 * @param ctx - Convex mutation context for timeline persistence calls
 * @param predictedEvents - Sparse predicted timeline write batches
 */
export const persistPredictedTimelineEvents = async (
  ctx: ActionCtx,
  predictedEvents: ReadonlyArray<ConvexPredictedDockWriteBatch>
): Promise<void> => {
  if (predictedEvents.length > 0) {
    await ctx.runMutation(
      internal.functions.events.eventsPredicted.mutations
        .projectPredictedDockWriteBatches,
      { Batches: Array.from(predictedEvents) }
    );
  }
};
