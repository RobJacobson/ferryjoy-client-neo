import { ConvexError, v } from "convex/values";
import { query } from "../../_generated/server";

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

/**
 * Get active vessel trip by vessel ID
 * Optimized with index for O(log n) performance
 */
export const getActiveTripByVesselId = query({
  args: { vesselId: v.number() },
  handler: async (ctx, args) => {
    try {
      const trip = await ctx.db
        .query("activeVesselTrips")
        .withIndex("by_vessel_id", (q) => q.eq("VesselID", args.vesselId))
        .first();
      return trip ?? null; // Return Convex doc directly
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch active trip for vessel ID ${args.vesselId}`,
        code: "QUERY_FAILED",
        severity: "error",
        details: { vesselId: args.vesselId, error: String(error) },
      });
    }
  },
});
