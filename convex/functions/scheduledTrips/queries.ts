import { query } from "_generated/server";
import { ConvexError, v } from "convex/values";

/**
 * Fetch a scheduled trip by its composite key
 * Used to match vessel trips with their scheduled counterparts
 *
 * @param ctx - Convex context
 * @param args.key - The composite trip key to search for
 * @returns The scheduled trip document or null if not found
 */
export const getScheduledTripByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    try {
      const trip = await ctx.db
        .query("scheduledTrips")
        .withIndex("by_key", (q) => q.eq("Key", args.key))
        .first();
      return trip;
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch scheduled trip for key ${args.key}`,
        code: "QUERY_FAILED",
        severity: "error",
        details: { key: args.key, error: String(error) },
      });
    }
  },
});

/**
 * Fetch all scheduled trips for a specific route
 * Used for verification and debugging purposes
 *
 * @param ctx - Convex context
 * @param args.routeId - The route ID to filter trips by
 * @returns Array of scheduled trip documents for the specified route
 */
export const getScheduledTripsForRoute = query({
  args: { routeId: v.number() },
  handler: async (ctx, args) => {
    try {
      const trips = await ctx.db
        .query("scheduledTrips")
        .withIndex("by_route", (q) => q.eq("RouteID", args.routeId))
        .collect();
      return trips;
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch scheduled trips for route ${args.routeId}`,
        code: "QUERY_FAILED",
        severity: "error",
        details: { routeId: args.routeId, error: String(error) },
      });
    }
  },
});

/**
 * Fetch scheduled trips for a specific route and date range
 * Used for verification to ensure exact date filtering
 * @param ctx - Convex context
 * @param args.routeId - The route ID to filter trips by
 * @param args.startDate - Start of date range (epoch milliseconds)
 * @param args.endDate - End of date range (epoch milliseconds)
 * @returns Array of scheduled trip documents within the specified route and date range
 */
export const getScheduledTripsForRouteAndDate = query({
  args: {
    routeId: v.number(),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      const trips = await ctx.db
        .query("scheduledTrips")
        .withIndex("by_route_and_departing_time", (q) =>
          q
            .eq("RouteID", args.routeId)
            .gte("DepartingTime", args.startDate)
            .lte("DepartingTime", args.endDate)
        )
        .collect();
      return trips;
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch scheduled trips for route ${args.routeId} in date range`,
        code: "QUERY_FAILED",
        severity: "error",
        details: {
          routeId: args.routeId,
          startDate: args.startDate,
          endDate: args.endDate,
          error: String(error),
        },
      });
    }
  },
});

/**
 * Fetch scheduled trips for a specific route and sailing day
 * Primary query for operational use - uses WSF sailing day concept
 * @param ctx - Convex context
 * @param args.routeId - The route ID to filter trips by
 * @param args.sailingDay - The sailing day in YYYY-MM-DD format
 * @returns Array of scheduled trip documents for the specified route and sailing day
 */
export const getScheduledTripsForRouteAndSailingDay = query({
  args: {
    routeId: v.number(),
    sailingDay: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const trips = await ctx.db
        .query("scheduledTrips")
        .withIndex("by_route_and_sailing_day", (q) =>
          q.eq("RouteID", args.routeId).eq("SailingDay", args.sailingDay)
        )
        .collect();
      return trips;
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch scheduled trips for route ${args.routeId} on sailing day ${args.sailingDay}`,
        code: "QUERY_FAILED",
        severity: "error",
        details: {
          routeId: args.routeId,
          sailingDay: args.sailingDay,
          error: String(error),
        },
      });
    }
  },
});

/**
 * Fetch all scheduled trips for a specific sailing day
 * Used for cross-route analytics and reporting
 * @param ctx - Convex context
 * @param args.sailingDay - The sailing day in YYYY-MM-DD format
 * @returns Array of all scheduled trip documents for the specified sailing day
 */
export const getScheduledTripsForSailingDay = query({
  args: { sailingDay: v.string() },
  handler: async (ctx, args) => {
    try {
      const trips = await ctx.db
        .query("scheduledTrips")
        .withIndex("by_sailing_day", (q) => q.eq("SailingDay", args.sailingDay))
        .collect();
      return trips;
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch scheduled trips for sailing day ${args.sailingDay}`,
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

/**
 * Find direct scheduled trips matching vessel, departing terminal, and exact scheduled departure.
 * Used to infer arriving terminal when a vessel arrives at dock without one reported.
 *
 * Matches trips based on:
 * - Vessel abbreviation
 * - Departing terminal abbreviation
 * - Exact scheduled departure time (no tolerance)
 * - Trip type must be "direct"
 *
 * @param ctx - Convex context
 * @param args.vesselAbbrev - The vessel abbreviation to match
 * @param args.departingTerminalAbbrev - The departing terminal abbreviation to match
 * @param args.scheduledDeparture - The scheduled departure time in epoch milliseconds (must match exactly)
 * @returns The matching direct scheduled trip document, or null if none found
 */
export const findScheduledTripForArrivalLookup = query({
  args: {
    vesselAbbrev: v.string(),
    departingTerminalAbbrev: v.string(),
    scheduledDeparture: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      // Query using composite index for exact match on all four parameters
      const matchingTrip = await ctx.db
        .query("scheduledTrips")
        .withIndex("by_vessel_terminal_time_type", (q) =>
          q
            .eq("VesselAbbrev", args.vesselAbbrev)
            .eq("DepartingTerminalAbbrev", args.departingTerminalAbbrev)
            .eq("DepartingTime", args.scheduledDeparture)
            .eq("TripType", "direct")
        )
        .first();

      return matchingTrip ?? null;
    } catch (error) {
      throw new ConvexError({
        message: `Failed to find scheduled trip for arrival lookup`,
        code: "QUERY_FAILED",
        severity: "error",
        details: {
          vesselAbbrev: args.vesselAbbrev,
          departingTerminalAbbrev: args.departingTerminalAbbrev,
          scheduledDeparture: args.scheduledDeparture,
          error: String(error),
        },
      });
    }
  },
});
