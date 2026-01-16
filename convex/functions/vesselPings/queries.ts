import { query } from "_generated/server";

/**
 * Get the latest 20 vessel pings from the database
 * @param ctx - Convex context
 * @returns Array of the latest 20 vessel ping collections
 */
export const getLatest = query({
  args: {},
  handler: async (ctx) => {
    const latestPings = await ctx.db
      .query("vesselPings")
      .order("desc")
      .take(20);
    return latestPings;
  },
});
