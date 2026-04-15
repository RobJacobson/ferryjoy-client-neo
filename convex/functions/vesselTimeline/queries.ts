/**
 * Exposes the backend-owned VesselTimeline backbone query.
 */

import type { QueryCtx } from "_generated/server";
import { query } from "_generated/server";
import { v } from "convex/values";
import { buildTimelineBackbone } from "../../domain/timelineBackbone";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import { vesselTimelineBackboneSchema } from "./schemas";

/**
 * Loads same-day boundary rows and builds the backbone payload used by the
 * public query.
 *
 * This helper stays inside `queries.ts` because it is private query
 * implementation, not a reusable functions-layer module.
 *
 * @param ctx - Convex query context
 * @param args - Vessel and sailing day scope
 * @returns Backbone result for the `getVesselTimelineBackbone` query
 */
export const loadVesselTimelineBackbone = async (
  ctx: QueryCtx,
  args: { VesselAbbrev: string; SailingDay: string }
) => {
  const [scheduledDocs, actualDocs, predictedDocs] = await Promise.all([
    ctx.db
      .query("eventsScheduled")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q
          .eq("VesselAbbrev", args.VesselAbbrev)
          .eq("SailingDay", args.SailingDay)
      )
      .collect(),
    ctx.db
      .query("eventsActual")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q
          .eq("VesselAbbrev", args.VesselAbbrev)
          .eq("SailingDay", args.SailingDay)
      )
      .collect(),
    ctx.db
      .query("eventsPredicted")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q
          .eq("VesselAbbrev", args.VesselAbbrev)
          .eq("SailingDay", args.SailingDay)
      )
      .collect(),
  ]);

  return buildTimelineBackbone({
    VesselAbbrev: args.VesselAbbrev,
    SailingDay: args.SailingDay,
    scheduledEvents: scheduledDocs.map(stripConvexMeta),
    actualEvents: actualDocs.map(stripConvexMeta),
    predictedEvents: predictedDocs.map(stripConvexMeta),
  });
};

/**
 * Returns the backend-owned VesselTimeline backbone for one vessel/day.
 *
 * @param ctx - Convex query context
 * @param args.VesselAbbrev - Vessel abbreviation
 * @param args.SailingDay - Sailing day in YYYY-MM-DD format
 * @returns Ordered timeline events for the requested sailing day
 */
export const getVesselTimelineBackbone = query({
  args: {
    VesselAbbrev: v.string(),
    SailingDay: v.string(),
  },
  returns: vesselTimelineBackboneSchema,
  handler: async (ctx, args) => loadVesselTimelineBackbone(ctx, args),
});
