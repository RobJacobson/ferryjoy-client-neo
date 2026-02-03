import { query } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { stripConvexMeta } from "shared/stripConvexMeta";
import type { ConvexVesselTrip } from "./schemas";

/**
 * API function for fetching active vessel trips (currently in progress)
 * Small dataset, frequently updated, perfect for real-time subscriptions
 * Optimized with proper indexing for performance
 *
 * @param ctx - Convex context
 * @returns Array of active vessel trip documents
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
 * API function for fetching all vessel trips for a specific sailing day.
 * Used to show historical actual data on the daily schedule.
 *
 * @param ctx - Convex context
 * @param args.sailingDay - The sailing day in YYYY-MM-DD format
 * @returns Array of vessel trip documents for that day
 */
export const getVesselTripsForSailingDay = query({
  args: { sailingDay: v.string() },
  handler: async (ctx, args) => {
    try {
      // We search both active and completed trips to get a full picture of the day
      const [active, completed] = await Promise.all([
        ctx.db.query("activeVesselTrips").collect(),
        ctx.db
          .query("completedVesselTrips")
          .withIndex("by_timestamp", (q) => q.gte("TimeStamp", 0))
          .collect(),
      ]);

      // Filter for the specific sailing day.
      // Note: In a production app, we'd want a proper index on SailingDay for completedVesselTrips too.
      const allTrips = [...active, ...completed].filter(
        (t) =>
          t.SailingDay === args.sailingDay ||
          t.ScheduledTrip?.SailingDay === args.sailingDay
      );

      return allTrips;
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch vessel trips for sailing day ${args.sailingDay}`,
        code: "QUERY_FAILED",
        severity: "error",
        details: { sailingDay: args.sailingDay, error: String(error) },
      });
    }
  },
});

/**
 * API function for fetching the most recent completed trip for a vessel
 * Used by prediction logic to access previous trip data for context
 *
 * @param ctx - Convex context
 * @param args.vesselAbbrev - The vessel abbreviation to find completed trips for
 * @returns The most recent completed trip document or null if none found
 */
export const getMostRecentCompletedTrip = query({
  args: { vesselAbbrev: v.string() },
  handler: async (ctx, args) => {
    try {
      const mostRecent = await ctx.db
        .query("completedVesselTrips")
        .withIndex("by_vessel_and_trip_end", (q) =>
          q.eq("VesselAbbrev", args.vesselAbbrev)
        )
        .order("desc")
        .first();

      if (!mostRecent) {
        return null;
      }

      return stripConvexMeta(mostRecent) as ConvexVesselTrip;
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
