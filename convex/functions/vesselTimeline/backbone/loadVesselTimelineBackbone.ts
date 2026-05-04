/**
 * Loads event-table rows for one vessel/sailing day and builds the backbone
 * payload via domain `buildTimelineBackbone`.
 */

import type { QueryCtx } from "_generated/server";
import { readActualDockEventsForVesselSailingDay } from "functions/events/eventsActual/queries";
import { readPredictedDockEventsForVesselSailingDay } from "functions/events/eventsPredicted/queries";
import { readScheduledDockEventsForVesselSailingDay } from "functions/events/eventsScheduled/queries";
import { buildTimelineBackbone } from "../../../domain/timelineBackbone";

/**
 * Loads event-table inputs and builds the vessel timeline backbone payload.
 *
 * Parallel-reads scheduled, actual, and predicted readers under one scope, then
 * calls `buildTimelineBackbone` for the wire shape consumed by
 * `getVesselTimelineBackbone`.
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
  const [scheduledEvents, actualEvents, predictedEvents] = await Promise.all([
    readScheduledDockEventsForVesselSailingDay(ctx, scope),
    readActualDockEventsForVesselSailingDay(ctx, scope),
    readPredictedDockEventsForVesselSailingDay(ctx, scope),
  ]);

  return buildTimelineBackbone({
    VesselAbbrev: args.VesselAbbrev,
    SailingDay: args.SailingDay,
    scheduledEvents,
    actualEvents,
    predictedEvents,
  });
};
