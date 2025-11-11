import { v } from "convex/values";
import { fromConvexVesselLocation } from "src/domain/vessels/vesselLocation";
import { query } from "../../_generated/server";

/**
 * Get vessel locations older than a given timestamp
 */
export const getOlderThan = query({
  args: {
    cutoffTime: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { cutoffTime, limit = 1000 }) => {
    const docs = await ctx.db
      .query("vesselLocations")
      .withIndex("by_timestamp", (q) => q.lt("TimeStamp", cutoffTime))
      .take(limit);
    return docs.map(fromConvexVesselLocation);
  },
});

/**
 * Get the latest location per vessel (deduped by VesselID, newest TimeStamp)
 */
export const getLatestLocations = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("vesselLocations").collect();
    // Deduplicate client-side for now; can be moved to an index later
    const byVessel: Record<number, { TimeStamp: number; doc: any }> = {};
    for (const d of docs) {
      const existing = byVessel[d.VesselID];
      if (!existing || d.TimeStamp > existing.TimeStamp) {
        byVessel[d.VesselID] = { TimeStamp: d.TimeStamp, doc: d };
      }
    }
    return Object.values(byVessel).map((x) => fromConvexVesselLocation(x.doc));
  },
});
