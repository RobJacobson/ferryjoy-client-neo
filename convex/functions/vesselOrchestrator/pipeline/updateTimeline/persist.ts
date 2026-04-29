/**
 * Persists timeline rows for one vessel branch.
 */

import type { MutationCtx } from "_generated/server";
import { upsertActualDockRows } from "functions/events/eventsActual/mutations";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import { projectPredictedDockWriteBatchesInDb } from "functions/events/eventsPredicted/mutations";
import type { ConvexPredictedDockWriteBatch } from "functions/events/eventsPredicted/schemas";

type PersistVesselTimelineWritesArgs = {
  actualEvents: ReadonlyArray<ConvexActualDockEvent>;
  predictedEvents: ReadonlyArray<ConvexPredictedDockWriteBatch>;
};

/**
 * Applies actual and predicted timeline writes when each set is non-empty.
 *
 * @param ctx - Convex mutation context for timeline persistence calls
 * @param args - Sparse actual and predicted timeline row batches
 * @returns Resolves when all applicable timeline writes are applied
 */
export const persistVesselTimelineWrites = async (
  ctx: MutationCtx,
  args: PersistVesselTimelineWritesArgs
): Promise<void> => {
  if (args.actualEvents.length > 0) {
    await upsertActualDockRows(ctx, Array.from(args.actualEvents));
  }
  if (args.predictedEvents.length > 0) {
    await projectPredictedDockWriteBatchesInDb(
      ctx,
      Array.from(args.predictedEvents)
    );
  }
};
