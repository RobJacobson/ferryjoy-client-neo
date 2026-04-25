/**
 * Public Convex queries for the route timeline read model.
 */

import { query } from "_generated/server";
import { v } from "convex/values";
import { buildRouteTimelineSnapshot } from "domain/routeTimeline";
import { loadRouteTimelineSnapshotInputs } from "./loadRouteTimelineSnapshotInputs";
import { routeTimelineSnapshotSchema } from "./schemas";

/**
 * Returns a route-scoped dock-visit snapshot for one sailing day: scheduled,
 * actual, and predicted overlays merged per vessel. Optional `VesselAbbrev`
 * and window bounds narrow scope metadata only; visit lists are not clipped in
 * Stage 3. Live vessel locations are not loaded.
 *
 * @param ctx - Convex query context
 * @param args.RouteAbbrev - Operational route code
 * @param args.SailingDay - Operational sailing day (YYYY-MM-DD)
 * @param args.VesselAbbrev - When set, only this vessel if it has trips on
 *   the route that day
 * @param args.WindowStart - Optional epoch ms; echoed on `Scope` only
 * @param args.WindowEnd - Optional epoch ms; echoed on `Scope` only
 * @returns Wire `RouteTimelineSnapshot` for the requested scope
 */
export const getRouteTimelineSnapshot = query({
  args: {
    RouteAbbrev: v.string(),
    SailingDay: v.string(),
    VesselAbbrev: v.optional(v.string()),
    WindowStart: v.optional(v.number()),
    WindowEnd: v.optional(v.number()),
  },
  returns: routeTimelineSnapshotSchema,
  handler: async (ctx, args) => {
    const { scheduledEvents, actualEvents, predictedEvents } =
      await loadRouteTimelineSnapshotInputs(ctx, {
        RouteAbbrev: args.RouteAbbrev,
        SailingDay: args.SailingDay,
        VesselAbbrev: args.VesselAbbrev,
      });

    return buildRouteTimelineSnapshot({
      RouteAbbrev: args.RouteAbbrev,
      SailingDay: args.SailingDay,
      scope: {
        VesselAbbrev: args.VesselAbbrev,
        WindowStart: args.WindowStart,
        WindowEnd: args.WindowEnd,
      },
      scheduledEvents,
      actualEvents,
      predictedEvents,
    });
  },
});
