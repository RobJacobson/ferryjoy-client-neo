import { query } from "_generated/server";
import { ConvexError } from "convex/values";

/**
 * Get all vessel locations from the database
 * @param ctx - Convex context
 * @returns Array of all vessel location records
 */
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    try {
      const vesselLocations = await ctx.db.query("vesselLocations").collect();
      return vesselLocations;
    } catch (error) {
      throw new ConvexError({
        message: "Failed to fetch all vessel locations",
        code: "QUERY_FAILED",
        severity: "error",
        details: { error: String(error) },
      });
    }
  },
});
