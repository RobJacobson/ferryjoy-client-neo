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

/**
 * API function for fetching completed vessel trips (finished trips)
 * Large dataset, infrequently updated, good for caching
 * Optimized with proper indexing for performance
 */
export const getCompletedTrips = query({
  args: {},
  handler: async (ctx) => {
    // Load all completed trips (Convex handles response size limits)
    const trips = await ctx.db.query("completedVesselTrips").collect();
    return trips;
  },
});

/**
 * Get paginated completed trips for ML processing
 */
export const getCompletedTripsPaginated = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 1000; // Smaller batches to stay under limits

    // Load all available training data for comprehensive model training
    return ctx.db.query("completedVesselTrips").paginate({
      cursor: args.cursor || null,
      numItems: limit,
    });
  },
});

/**
 * Get trip counts by terminal pair for analysis
 */
export const getTerminalPairCounts = query({
  args: {},
  handler: async (ctx) => {
    const trips = await ctx.db.query("completedVesselTrips").take(5000);
    const counts = new Map<string, number>();

    trips.forEach((trip) => {
      if (trip.DepartingTerminalAbbrev && trip.ArrivingTerminalAbbrev) {
        const key = `${trip.DepartingTerminalAbbrev}_${trip.ArrivingTerminalAbbrev}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });

    return Array.from(counts.entries())
      .map(([pair, count]) => ({ pair, count }))
      .sort((a, b) => b.count - a.count);
  },
});
