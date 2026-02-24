import { query } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { vesselTripSchema } from "functions/vesselTrips/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";

/**
 * API function for fetching active vessel trips (currently in progress)
 * Small dataset, frequently updated, perfect for real-time subscriptions
 * Optimized with proper indexing for performance
 *
 * @param ctx - Convex context
 * @returns Array of active vessel trips (schema shape, no _id/_creationTime)
 */
export const getActiveTrips = query({
  args: {},
  returns: v.array(vesselTripSchema),
  handler: async (ctx) => {
    try {
      const trips = await ctx.db.query("activeVesselTrips").collect();
      return trips.map(stripConvexMeta);
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
 * Fetch the most recent completed trip for a vessel.
 * Used for backfilling depart-next predictions when current trip leaves dock.
 *
 * @param ctx - Convex context
 * @param args.vesselAbbrev - Vessel abbreviation to find most recent completed trip for
 * @returns Most recent completed trip (schema shape), or null if none exists
 */
export const getMostRecentCompletedTrip = query({
  args: {
    vesselAbbrev: v.string(),
  },
  returns: v.nullable(vesselTripSchema),
  handler: async (ctx, args) => {
    try {
      const mostRecent = await ctx.db
        .query("completedVesselTrips")
        .withIndex("by_vessel_and_trip_end", (q) =>
          q.eq("VesselAbbrev", args.vesselAbbrev)
        )
        .order("desc")
        .first();

      return mostRecent ? stripConvexMeta(mostRecent) : null;
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

/**
 * Fetches completed vessel trips for a sailing day and set of departing terminals.
 * Uses indexed lookups only; matches ScheduledTrips usage (sailing day + terminal).
 *
 * @param ctx - Convex context
 * @param args.sailingDay - Sailing day in YYYY-MM-DD format
 * @param args.departingTerminalAbbrevs - Terminal abbreviations to include
 * @returns Array of completed vessel trips (schema shape), deduped by Key
 */
export const getCompletedTripsForSailingDayAndTerminals = query({
  args: {
    sailingDay: v.string(),
    departingTerminalAbbrevs: v.array(v.string()),
  },
  returns: v.array(vesselTripSchema),
  handler: async (ctx, args) => {
    try {
      const terminals = [...new Set(args.departingTerminalAbbrevs)];
      const results = await Promise.all(
        terminals.map((terminal) =>
          ctx.db
            .query("completedVesselTrips")
            .withIndex("by_sailing_day_and_departing_terminal", (q) =>
              q
                .eq("SailingDay", args.sailingDay)
                .eq("DepartingTerminalAbbrev", terminal)
            )
            .collect()
        )
      );
      const byKey = new Map<string, (typeof results)[0][number]>();
      for (const batch of results) {
        for (const doc of batch) {
          if (doc.Key) byKey.set(doc.Key, doc);
        }
      }
      return Array.from(byKey.values()).map(stripConvexMeta);
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch completed trips for sailing day ${args.sailingDay}`,
        code: "QUERY_FAILED",
        severity: "error",
        details: {
          sailingDay: args.sailingDay,
          error: String(error),
        },
      });
    }
  },
});
