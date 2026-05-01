/**
 * Action-side wiring from `updateVesselTrip` domain code to narrow internal
 * schedule queries (`vesselTripScheduleQueries`).
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { UpdateVesselTripDbAccess } from "domain/vesselOrchestration/updateVesselTrip";

/**
 * Builds a minimal database accessor for updateVesselTrip.
 *
 * Domain `updateVesselTrip` stays Convex-agnostic; this factory closes the
 * loop with `ctx.runQuery` into schedule segment and rollover reads. Call once
 * per ping and reuse the object for every vessel branch so query wiring stays
 * stable across the sequential loop.
 *
 * @param ctx - Convex action context used for internal schedule queries
 * @returns Key-first schedule resolution read functions
 */
export const createUpdateVesselTripDbAccess = (
  ctx: ActionCtx
): UpdateVesselTripDbAccess => ({
  getScheduledSegmentByScheduleKey: async (scheduleKey) =>
    ctx.runQuery(
      internal.functions.vesselOrchestrator.queries.vesselTripScheduleQueries
        .getScheduledSegmentByScheduleKeyInternal,
      { scheduleKey }
    ),
  getScheduleRolloverDockEvents: async (args) =>
    ctx.runQuery(
      internal.functions.vesselOrchestrator.queries.vesselTripScheduleQueries
        .getScheduleRolloverDockEventsInternal,
      args
    ),
});
