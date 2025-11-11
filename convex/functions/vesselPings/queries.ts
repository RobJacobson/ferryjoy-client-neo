import { query } from "@convex/_generated/server";
import { v } from "convex/values";

/**
 * Get VesselPings older than the specified timestamp
 * Used for cleanup operations to delete old records
 */
export const getOlderThan = query({
  args: {
    cutoffTime: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { cutoffTime, limit = 1000 }) => {
    return await ctx.db
      .query("vesselPings")
      .withIndex("by_timestamp", (q) => q.lt("TimeStamp", cutoffTime))
      .order("asc") // Get oldest first for deletion
      .take(limit);
  },
});

/**
 * Get VesselPings strictly newer than the provided timestamp
 * Used for incremental fetches after initial hydration
 */
export const getPingsSince = query({
  args: {
    sinceMs: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sinceMs, limit = 1000 }) => {
    return await ctx.db
      .query("vesselPings")
      .withIndex("by_timestamp", (q) => q.gt("TimeStamp", sinceMs))
      .order("asc")
      .take(limit);
  },
});
