/**
 * Exposes the backend-owned VesselTimeline event-first view-model query.
 */

import { query } from "_generated/server";
import { v } from "convex/values";
import { buildVesselTimelineViewModel } from "../../domain/vesselTimeline/viewModel";
import { loadVesselTimelineViewModelInputs } from "./loaders";
import { vesselTimelineViewModelSchema } from "./schemas";

/**
 * Returns the backend-owned VesselTimeline view model for one vessel/day.
 *
 * @param ctx - Convex query context
 * @param args.VesselAbbrev - Vessel abbreviation
 * @param args.SailingDay - Sailing day in YYYY-MM-DD format
 * @returns Ordered timeline events, active interval, and live state
 */
export const getVesselTimelineViewModel = query({
  args: {
    VesselAbbrev: v.string(),
    SailingDay: v.string(),
  },
  returns: vesselTimelineViewModelSchema,
  handler: async (ctx, args) => {
    const inputs = await loadVesselTimelineViewModelInputs(ctx, args);

    return buildVesselTimelineViewModel({
      VesselAbbrev: args.VesselAbbrev,
      SailingDay: args.SailingDay,
      ...inputs,
    });
  },
});
