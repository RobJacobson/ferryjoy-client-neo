import { ConvexError, v } from "convex/values";
import { query } from "../../_generated/server";

/**
 * API function for fetching completed vessel trips for ML training
 * Historical data used to train prediction models
 */
export const getCompletedTrips = query({
  args: {},
  handler: async (ctx) => {
    try {
      const trips = await ctx.db
        .query("completedVesselTrips")
        .order("desc")
        .collect(); // ~4,000 historical records
      return trips; // Return Convex docs only
    } catch (error) {
      throw new ConvexError({
        message: "Failed to fetch completed vessel trips",
        code: "QUERY_FAILED",
        severity: "error",
        details: { error: String(error) },
      });
    }
  },
});

/**
 * Get completed vessel trips by vessel ID
 */
export const getCompletedTripsByVesselId = query({
  args: { vesselId: v.number() },
  handler: async (ctx, args) => {
    try {
      const trips = await ctx.db
        .query("completedVesselTrips")
        .filter((q) => q.eq(q.field("VesselID"), args.vesselId))
        .order("desc")
        .collect();
      return trips; // Return Convex docs only
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch completed trips for vessel ID ${args.vesselId}`,
        code: "QUERY_FAILED",
        severity: "error",
        details: { vesselId: args.vesselId, error: String(error) },
      });
    }
  },
});
