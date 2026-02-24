import { internalQuery, query } from "_generated/server";
import { ConvexError, v } from "convex/values";
import {
  scheduledTripDocSchema,
  scheduledTripSchema,
} from "functions/scheduledTrips/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";

/**
 * Fetch all scheduled trips for a specific sailing day
 * Used for cross-route analytics and reporting
 * @param ctx - Convex context
 * @param args.sailingDay - The sailing day in YYYY-MM-DD format
 * @returns Array of scheduled trips (schema shape) for the specified sailing day
 */
export const getScheduledTripsForSailingDay = query({
  args: { sailingDay: v.string() },
  returns: v.array(scheduledTripSchema),
  handler: async (ctx, args) => {
    try {
      const trips = await ctx.db
        .query("scheduledTrips")
        .withIndex("by_sailing_day", (q) => q.eq("SailingDay", args.sailingDay))
        .collect();
      return trips.map(stripConvexMeta);
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
 * Returns raw scheduled trip rows for a terminal and sailing day.
 * No server-side aggregation: client maps to domain and reconstructs journeys.
 *
 * @param ctx - Convex context
 * @param args.terminalAbbrev - Departure terminal abbreviation
 * @param args.sailingDay - Sailing day YYYY-MM-DD
 * @returns Flat array of scheduled trips (schema shape) - vessels that depart from this terminal that day
 */
export const getScheduledTripsForTerminal = query({
  args: {
    terminalAbbrev: v.string(),
    destinationAbbrev: v.optional(v.string()),
    sailingDay: v.string(),
  },
  returns: v.array(scheduledTripSchema),
  handler: async (ctx, args) => {
    try {
      const startingTrips = await ctx.db
        .query("scheduledTrips")
        .withIndex("by_terminal_and_sailing_day", (q) =>
          q
            .eq("DepartingTerminalAbbrev", args.terminalAbbrev)
            .eq("SailingDay", args.sailingDay)
        )
        .collect();

      if (startingTrips.length === 0) return [];

      const vesselAbbrevs = Array.from(
        new Set(startingTrips.map((t) => t.VesselAbbrev))
      );
      const allVesselTrips = (
        await Promise.all(
          vesselAbbrevs.map((vessel) =>
            ctx.db
              .query("scheduledTrips")
              .withIndex("by_vessel_and_sailing_day", (q) =>
                q
                  .eq("VesselAbbrev", vessel)
                  .eq("SailingDay", args.sailingDay)
              )
              .collect()
          )
        )
      ).flat();

      return allVesselTrips.map(stripConvexMeta);
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch scheduled trips for terminal ${args.terminalAbbrev}`,
        code: "QUERY_FAILED",
        severity: "error",
        details: {
          terminalAbbrev: args.terminalAbbrev,
          destinationAbbrev: args.destinationAbbrev,
          sailingDay: args.sailingDay,
          error: String(error),
        },
      });
    }
  },
});

/**
 * Find direct scheduled trip ID matching vessel, departing terminal, and exact scheduled departure.
 * Used by vessel trips to get reference ID when arriving at dock.
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
 * @returns The matching direct scheduled trip document ID, or null if none found
 */
export const getScheduledTripIdByKey = internalQuery({
  args: {
    key: v.string(),
  },
  returns: v.union(v.id("scheduledTrips"), v.null()),
  handler: async (ctx, args) => {
    try {
      const matchingTrip = await ctx.db
        .query("scheduledTrips")
        .withIndex("by_key", (q) => q.eq("Key", args.key))
        .first();

      return matchingTrip?._id ?? null;
    } catch (error) {
      throw new ConvexError({
        message: "Failed to find scheduled trip ID for arrival lookup",
        code: "QUERY_FAILED",
        severity: "error",
        details: {
          key: args.key,
          error: String(error),
        },
      });
    }
  },
});

/**
 * Find direct scheduled trips matching vessel, departing terminal, and exact scheduled departure
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
 * @returns The matching direct scheduled trip (full Doc with _id, _creationTime), or null if none found
 */
export const findScheduledTripForArrivalLookup = query({
  args: {
    vesselAbbrev: v.string(),
    departingTerminalAbbrev: v.string(),
    scheduledDeparture: v.number(),
  },
  returns: v.union(scheduledTripDocSchema, v.null()),
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

      return matchingTrip ? matchingTrip : null;
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

/**
 * Fetch all direct scheduled trips for a specific vessel and sailing day.
 * Used for vertical daily timeline view.
 *
 * @param ctx - Convex context
 * @param args.vesselAbbrev - The vessel abbreviation to filter by
 * @param args.sailingDay - The sailing day in YYYY-MM-DD format
 * @returns Array of direct scheduled trips (schema shape) sorted by departing time
 */
export const getDirectScheduledTripsForVessel = query({
  args: {
    vesselAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.array(scheduledTripSchema),
  handler: async (ctx, args) => {
    try {
      const trips = await ctx.db
        .query("scheduledTrips")
        .withIndex("by_vessel_sailing_day_trip_type", (q) =>
          q
            .eq("VesselAbbrev", args.vesselAbbrev)
            .eq("SailingDay", args.sailingDay)
            .eq("TripType", "direct")
        )
        .collect();

      return trips.map(stripConvexMeta);
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch direct scheduled trips for vessel ${args.vesselAbbrev} on sailing day ${args.sailingDay}`,
        code: "QUERY_FAILED",
        severity: "error",
        details: {
          vesselAbbrev: args.vesselAbbrev,
          sailingDay: args.sailingDay,
          error: String(error),
        },
      });
    }
  },
});
