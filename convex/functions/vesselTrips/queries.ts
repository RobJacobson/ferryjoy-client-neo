import { query } from "_generated/server";
import { ConvexError, v } from "convex/values";

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
 * Fetches completed vessel trips for a sailing day and set of departing terminals.
 * Uses indexed lookups only; matches ScheduledTrips usage (sailing day + terminal).
 *
 * @param ctx - Convex context
 * @param args.sailingDay - Sailing day in YYYY-MM-DD format
 * @param args.departingTerminalAbbrevs - Terminal abbreviations to include
 * @returns Array of completed vessel trip documents, deduped by Key
 */
export const getCompletedTripsForSailingDayAndTerminals = query({
  args: {
    sailingDay: v.string(),
    departingTerminalAbbrevs: v.array(v.string()),
  },
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
      return Array.from(byKey.values());
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
