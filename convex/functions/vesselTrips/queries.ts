import { query } from "_generated/server";
import { ConvexError, v } from "convex/values";

/**
 * API function for fetching active vessel trips (currently in progress)
 * Small dataset, frequently updated, perfect for real-time subscriptions
 * Optimized with proper indexing for performance
 */
export const getActiveTrips = query({
  args: {},
  handler: async (ctx) => {
    try {
      const trips = await ctx.db.query("activeVesselTrips").collect();
      return trips; // Return Convex docs (numbers/undefined), no Date conversion here
    } catch (error) {
      throw new ConvexError({
        message: "Failed to fetch active vessel trips",
        code: "QUERY_FAILED",
        severity: "error",
        details: { error: String(error) },
      });
    }
  },
});
