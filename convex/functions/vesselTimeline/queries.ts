/**
 * Exposes queries for reading persisted `vesselTimelineSnapshots`.
 */

import { query } from "_generated/server";
import { v } from "convex/values";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import { vesselTimelineSnapshotSchema } from "./schemas";

export const getVesselDayTimelineSnapshot = query({
  args: {
    VesselAbbrev: v.string(),
    SailingDay: v.string(),
  },
  returns: v.union(vesselTimelineSnapshotSchema, v.null()),
  handler: async (ctx, args) => {
    const snapshot = await ctx.db
      .query("vesselTimelineSnapshots")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q
          .eq("VesselAbbrev", args.VesselAbbrev)
          .eq("SailingDay", args.SailingDay)
      )
      .unique();

    if (!snapshot) {
      return null;
    }

    return stripConvexMeta(snapshot);
  },
});
