/* eslint-disable @typescript-eslint/no-explicit-any */
/** biome-ignore-all lint/suspicious/noExplicitAny: hardcoded fields */

import { v } from "convex/values";
import { query } from "../../_generated/server";

/**
 * Get VesselPingCollections older than specified timestamp
 * Used for cleanup operations to delete old records
 */
export const getOlderThan = query({
  args: {
    cutoffTime: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { cutoffTime, limit = 1000 }) => {
    const collections = await ctx.db
      .query("vesselPings")
      .withIndex("by_timestamp", q => q.lt("timestamp", cutoffTime))
      .order("asc") // Get oldest first for deletion
      .take(limit);

    return collections;
  },
});
