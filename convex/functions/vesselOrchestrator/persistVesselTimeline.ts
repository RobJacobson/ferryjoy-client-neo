/**
 * Timeline projection + persistence helpers for per-vessel orchestrator writes.
 */

import type { MutationCtx } from "_generated/server";
import type {
  MlTimelineOverlay,
  PersistedTripTimelineHandoff,
} from "domain/vesselOrchestration/shared";
import { updateTimeline } from "domain/vesselOrchestration/updateTimeline";
import { upsertActualDockRows } from "functions/events/eventsActual/mutations";
import { projectPredictedDockWriteBatchesInDb } from "functions/events/eventsPredicted/mutations";

type PersistVesselTimelineWritesArgs = {
  pingStartedAt: number;
  tripHandoffForTimeline: PersistedTripTimelineHandoff;
  mlTimelineOverlays: ReadonlyArray<MlTimelineOverlay>;
};

/**
 * Projects timeline writes and persists sparse actual/predicted rows.
 *
 * @param ctx - Convex mutation context
 * @param args - Per-vessel timeline projection inputs
 */
export const persistVesselTimelineWrites = async (
  ctx: MutationCtx,
  args: PersistVesselTimelineWritesArgs
): Promise<void> => {
  const { actualEvents, predictedEvents } = updateTimeline({
    pingStartedAt: args.pingStartedAt,
    tripHandoffForTimeline: args.tripHandoffForTimeline,
    mlTimelineOverlays: args.mlTimelineOverlays,
  });

  if (actualEvents.length > 0) {
    await upsertActualDockRows(ctx, actualEvents);
  }
  if (predictedEvents.length > 0) {
    await projectPredictedDockWriteBatchesInDb(ctx, predictedEvents);
  }
};
