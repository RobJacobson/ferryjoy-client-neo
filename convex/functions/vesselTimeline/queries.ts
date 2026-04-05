/**
 * Exposes the backend-owned VesselTimeline backbone query.
 */

import { query } from "_generated/server";
import { v } from "convex/values";
import * as vesselTimelineBackbone from "./backbone/getVesselTimelineBackbone";
import { vesselTimelineBackboneSchema } from "./schemas";

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
  handler: async (ctx, args) =>
    vesselTimelineBackbone.getVesselTimelineBackbone(ctx, args),
});
