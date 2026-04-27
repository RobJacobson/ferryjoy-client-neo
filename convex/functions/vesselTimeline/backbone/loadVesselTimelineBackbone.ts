/**
 * Loads event-table rows for one vessel/sailing day and builds the backbone
 * payload via domain `buildTimelineBackbone`.
 */

import type { QueryCtx } from "_generated/server";
import { loadActualDockEventsForVesselSailingDay } from "functions/events/eventsActual/queries";
import { loadPredictedDockEventsForVesselSailingDay } from "functions/events/eventsPredicted/queries";
import { queryScheduledDockEventsForVesselSailingDay } from "functions/events/eventsScheduled/queries";
import { buildTimelineBackbone } from "../../../domain/timelineBackbone";
import { stripConvexMeta } from "../../../shared/stripConvexMeta";

/**
 * Loads same-day event-table rows via `functions/even-0=ts/**` query helpers, then
 * builds the backbone payload used by the public query.
 *
 * @param ctx - Convex query context
 * @param args - Vessel and sailing day scope
 * @returns Backbone result for the `getVesselTimelineBackbone` query
 */
export const loadVesselTimelineBackbone = async (
  ctx: QueryCtx,
  args: { VesselAbbrev: string; SailingDay: string }
) => {
  const scope = {
    vesselAbbrev: args.VesselAbbrev,
    sailingDay: args.SailingDay,
  };
  const [scheduledDocs, actualDocs, predictedDocs] = await Promise.all([
    queryScheduledDockEventsForVesselSailingDay(ctx, scope),
    loadActualDockEventsForVesselSailingDay(ctx, scope),
    loadPredictedDockEventsForVesselSailingDay(ctx, scope),
  ]);

  return buildTimelineBackbone({
    VesselAbbrev: args.VesselAbbrev,
    SailingDay: args.SailingDay,
    scheduledEvents: scheduledDocs.map(stripConvexMeta),
    actualEvents: actualDocs.map(stripConvexMeta),
    predictedEvents: predictedDocs.map(stripConvexMeta),
  });
};
