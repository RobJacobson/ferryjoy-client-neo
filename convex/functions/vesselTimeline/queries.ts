/**
 * Registers the backend-owned VesselTimeline backbone query.
 */

import { query } from "_generated/server";
import { v } from "convex/values";
import { loadVesselTimelineBackbone } from "./backbone";
import { vesselTimelineBackboneSchema } from "./schemas";

/**
 * Returns the vessel timeline backbone for one vessel and sailing day.
 *
 * Delegates to `loadVesselTimelineBackbone`, which reads the three event tables
 * and runs domain `buildTimelineBackbone`.
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
