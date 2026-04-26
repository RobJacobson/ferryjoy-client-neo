/**
 * Timeline persistence helpers for per-vessel orchestrator writes.
 */

import type { MutationCtx } from "_generated/server";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexPredictedDockWriteBatch } from "functions/events/eventsPredicted/schemas";
import { upsertActualDockRows } from "functions/events/eventsActual/mutations";
import { projectPredictedDockWriteBatchesInDb } from "functions/events/eventsPredicted/mutations";

type PersistVesselTimelineWritesArgs = {
  actualEvents: ReadonlyArray<ConvexActualDockEvent>;
  predictedEvents: ReadonlyArray<ConvexPredictedDockWriteBatch>;
};

/**
 * Persists sparse actual/predicted timeline rows.
 *
 * @param ctx - Convex mutation context
 * @param args - Per-vessel timeline projection inputs
 */
export const persistVesselTimelineWrites = async (
  ctx: MutationCtx,
  args: PersistVesselTimelineWritesArgs
): Promise<void> => {
  if (args.actualEvents.length > 0) {
    await upsertActualDockRows(ctx, Array.from(args.actualEvents));
  }
  if (args.predictedEvents.length > 0) {
    await projectPredictedDockWriteBatchesInDb(ctx, Array.from(args.predictedEvents));
  }
};
