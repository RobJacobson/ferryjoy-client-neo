import { query } from "_generated/server";
import { ConvexError } from "convex/values";

/**
 * Get the latest 20 vessel pings from the database
 * @param ctx - Convex context
 * @returns Array of the latest 20 vessel ping collections
 */
export const getLatest = query({
  args: {},
  handler: async (ctx) => {
    try {
      const latestPings = await ctx.db
        .query("vesselPings")
        .order("desc")
        .take(20);
      return latestPings;
    } catch (error) {
      throw new ConvexError({
        message: "Failed to fetch latest 20 vessel ping collections",
        code: "QUERY_FAILED",
        severity: "error",
        details: { error: String(error), limit: 20 },
      });
    }
  },
});
