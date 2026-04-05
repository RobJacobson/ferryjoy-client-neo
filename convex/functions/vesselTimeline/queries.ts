/**
 * Exposes the backend-owned VesselTimeline backbone query.
 */

import { query } from "_generated/server";
import { v } from "convex/values";
import { buildVesselTimelineBackbone } from "../../domain/vesselTimeline/viewModel";
import { loadVesselTimelineBackboneInputs } from "./loaders";
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
  handler: async (ctx, args) => {
    const inputs = await loadVesselTimelineBackboneInputs(ctx, args);

    return buildVesselTimelineBackbone({
      VesselAbbrev: args.VesselAbbrev,
      SailingDay: args.SailingDay,
      ...inputs,
    });
  },
});
