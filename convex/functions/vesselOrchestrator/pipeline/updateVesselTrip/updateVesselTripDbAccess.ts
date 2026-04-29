/**
 * Database helpers for vessel trip data reads.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { UpdateVesselTripDbAccess } from "domain/vesselOrchestration/updateVesselTrip";

/**
 * Builds a minimal database accessor for updateVesselTrip.
 *
 * @param ctx - Convex action context used for internal schedule queries
 * @returns Key-first schedule resolution read functions
 */
export const createUpdateVesselTripDbAccess = (
  ctx: ActionCtx
): UpdateVesselTripDbAccess => ({
  getScheduledSegmentByScheduleKey: async (scheduleKey) =>
    ctx.runQuery(
      internal.functions.vesselOrchestrator.pipeline.updateVesselTrip.queries
        .getScheduledSegmentByScheduleKeyInternal,
      { scheduleKey }
    ),
  getScheduleRolloverDockEvents: async (args) =>
    ctx.runQuery(
      internal.functions.vesselOrchestrator.pipeline.updateVesselTrip.queries
        .getScheduleRolloverDockEventsInternal,
      args
    ),
});
