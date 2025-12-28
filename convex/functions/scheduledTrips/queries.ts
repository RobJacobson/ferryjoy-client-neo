import { query } from "_generated/server";
import { ConvexError, v } from "convex/values";

/**
 * Fetch all scheduled trips for a specific route
 * Used for verification and debugging purposes
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
