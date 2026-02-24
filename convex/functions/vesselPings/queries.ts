import { query } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import { vesselPingListValidationSchema } from "./schemas";

/**
 * Get the latest 20 vessel pings from the database
 *
 * @param ctx - Convex context
 * @returns Array of the latest 20 vessel ping collections without metadata
 */
export const getLatest = query({
  args: {},
  returns: v.array(vesselPingListValidationSchema),
  handler: async (ctx) => {
    try {
      const latestPings = await ctx.db
        .query("vesselPings")
        .order("desc")
        .take(20);
      return latestPings.map(stripConvexMeta);
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
