import { query } from "_generated/server";

/**
 * Get all vessel pings from the last 10 minutes using index search
 * Returns individual vessel ping documents, not collections
 *
 * @param ctx - Convex context
 * @returns Array of vessel ping records from the last 10 minutes
 */
export const getLatest = query({
  args: {},
  handler: async (ctx) => {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000; // 10 minutes in milliseconds

    const latestPings = await ctx.db
      .query("vesselPing")
      .withIndex("by_timestamp", (q) => q.gte("TimeStamp", tenMinutesAgo))
      .collect();

    return latestPings;
  },
});
