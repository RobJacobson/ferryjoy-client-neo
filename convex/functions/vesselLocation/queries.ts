import { v } from "convex/values";
import { query } from "../../_generated/server";
import type { ConvexVesselLocation } from "./schemas";
import { toDomainVesselLocation } from "./schemas";

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
    return docs.map(toDomainVesselLocation);
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
    const byVessel: Record<
      number,
      { TimeStamp: number; doc: ConvexVesselLocation }
    > = {};
    for (const d of docs) {
      const existing = byVessel[d.VesselID];
      // Docs from database are in Convex format (numbers)
      const doc = d as unknown as ConvexVesselLocation;
      const timeStamp = doc.TimeStamp as unknown as number;
      if (!existing || timeStamp > existing.TimeStamp) {
        byVessel[d.VesselID] = { TimeStamp: timeStamp, doc };
      }
    }
    return Object.values(byVessel).map((x) => toDomainVesselLocation(x.doc));
  },
});
