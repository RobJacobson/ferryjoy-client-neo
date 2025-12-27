import { query } from "_generated/server";
import { ConvexError, v } from "convex/values";
import type { ConvexVesselTrip } from "./schemas";

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
 * API function for fetching the most recent completed trip for a vessel
 * Used by prediction logic to access previous trip data for context
 */
export const getMostRecentCompletedTrip = query({
  args: { vesselAbbrev: v.string() },
  handler: async (ctx, args) => {
    try {
      const trips = await ctx.db
        .query("completedVesselTrips")
        .withIndex("by_vessel_abbrev", (q) =>
          q.eq("VesselAbbrev", args.vesselAbbrev)
        )
        .collect();

      if (trips.length === 0) {
        return null;
      }

      // Sort by TripEnd descending to get the most recent completed trip
      // Filter out trips without TripEnd (shouldn't happen, but defensive)
      const tripsWithEnd = trips.filter((trip) => trip.TripEnd !== undefined);
      if (tripsWithEnd.length === 0) {
        return null;
      }

      tripsWithEnd.sort((a, b) => (b.TripEnd ?? 0) - (a.TripEnd ?? 0));
      const mostRecent = tripsWithEnd[0];
      if (!mostRecent) {
        return null;
      }
      // Strip Convex document metadata (_id, _creationTime) to return just the trip data
      const { _id, _creationTime, ...tripData } = mostRecent;
      return tripData as ConvexVesselTrip;
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch most recent completed trip for vessel ${args.vesselAbbrev}`,
        code: "QUERY_FAILED",
        severity: "error",
        details: { vesselAbbrev: args.vesselAbbrev, error: String(error) },
      });
    }
  },
});
