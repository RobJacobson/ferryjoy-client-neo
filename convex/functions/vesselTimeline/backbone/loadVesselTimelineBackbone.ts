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
 * Loads event-table inputs and builds the vessel timeline backbone payload.
 *
 * Parallel-reads scheduled, actual, and predicted helpers under one scope, strips
 * metadata from actual/predicted docs, then calls `buildTimelineBackbone` for
 * the wire shape consumed by `getVesselTimelineBackbone`.
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
