import { internalQuery, query } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { scheduledTripSchema } from "functions/scheduledTrips/schemas";
import { getSailingDay } from "shared/time";
import { stripConvexMeta } from "shared/stripConvexMeta";

/**
 * Fetch scheduled trips for a route and trip date (sailing day).
 * Used by UnifiedTripsContext to load route-scoped trip data.
 *
 * @param ctx - Convex context
 * @param args.routeAbbrev - Route abbreviation (e.g. "sea-bi")
 * @param args.tripDate - Sailing day in YYYY-MM-DD format
 * @returns Array of scheduled trips (schema shape) for the route and date
 */
export const getScheduledTripsByRouteAndTripDate = query({
  args: {
    routeAbbrev: v.string(),
    tripDate: v.string(),
  },
  returns: v.array(scheduledTripSchema),
  handler: async (ctx, args) => {
    try {
      const trips = await ctx.db
        .query("scheduledTrips")
        .withIndex("by_route_abbrev_and_sailing_day", (q) =>
          q.eq("RouteAbbrev", args.routeAbbrev).eq("SailingDay", args.tripDate)
        )
        .collect();
      return trips.map(stripConvexMeta);
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch scheduled trips for route ${args.routeAbbrev} on ${args.tripDate}`,
        code: "QUERY_FAILED",
        severity: "error",
        details: {
          routeAbbrev: args.routeAbbrev,
          tripDate: args.tripDate,
          error: String(error),
        },
      });
    }
  },
});

/**
 * Fetch direct scheduled trips for multiple routes and trip date.
 * Used by UnifiedTripsContext for triangle (f-v-s) and other multi-route views.
 * Returns only TripType === "direct" trips.
 *
 * @param ctx - Convex context
 * @param args.routeAbbrevs - Route abbreviations (e.g. ["f-s", "f-v-s", "s-v"])
 * @param args.tripDate - Sailing day in YYYY-MM-DD format
 * @returns Array of direct scheduled trips (schema shape) for the routes and date
 */
export const getDirectScheduledTripsByRoutesAndTripDate = query({
  args: {
    routeAbbrevs: v.array(v.string()),
    tripDate: v.string(),
  },
  returns: v.array(scheduledTripSchema),
  handler: async (ctx, args) => {
    try {
      const uniqueRoutes = [...new Set(args.routeAbbrevs)];
      const batches = await Promise.all(
        uniqueRoutes.map((routeAbbrev) =>
          ctx.db
            .query("scheduledTrips")
            .withIndex("by_route_abbrev_and_sailing_day", (q) =>
              q.eq("RouteAbbrev", routeAbbrev).eq("SailingDay", args.tripDate)
            )
            .collect()
        )
      );
      const allTrips = batches.flat();
      const directOnly = allTrips.filter((t) => t.TripType === "direct");
      return directOnly.map(stripConvexMeta);
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch direct scheduled trips for routes on ${args.tripDate}`,
        code: "QUERY_FAILED",
        severity: "error",
        details: {
          routeAbbrevs: args.routeAbbrevs,
          tripDate: args.tripDate,
          error: String(error),
        },
      });
    }
  },
});

/**
 * Fetch all scheduled trips (direct + indirect) for multiple routes and trip date.
 * Used for building byKey map when resolving indirect trips via resolveIndirectToSegments.
 *
 * @param ctx - Convex context
 * @param args.routeAbbrevs - Route abbreviations (e.g. ["f-s", "f-v-s", "s-v"])
 * @param args.tripDate - Sailing day in YYYY-MM-DD format
 * @returns Array of all scheduled trips (schema shape) for the routes and date
 */
export const getScheduledTripsByRoutesAndTripDate = query({
  args: {
    routeAbbrevs: v.array(v.string()),
    tripDate: v.string(),
  },
  returns: v.array(scheduledTripSchema),
  handler: async (ctx, args) => {
    try {
      const uniqueRoutes = [...new Set(args.routeAbbrevs)];
      const batches = await Promise.all(
        uniqueRoutes.map((routeAbbrev) =>
          ctx.db
            .query("scheduledTrips")
            .withIndex("by_route_abbrev_and_sailing_day", (q) =>
              q.eq("RouteAbbrev", routeAbbrev).eq("SailingDay", args.tripDate)
            )
            .collect()
        )
      );
      return batches.flat().map(stripConvexMeta);
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch scheduled trips for routes on ${args.tripDate}`,
        code: "QUERY_FAILED",
        severity: "error",
        details: {
          routeAbbrevs: args.routeAbbrevs,
          tripDate: args.tripDate,
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
                q.eq("VesselAbbrev", vessel).eq("SailingDay", args.sailingDay)
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
 * Find a scheduled trip by its stable composite Key.
 * Used internally for VesselTrip schedule enrichment and joins.
 *
 * @param ctx - Convex context
 * @param args.key - Stable trip key shared with VesselTrips
 * @returns The matching scheduled trip, or null if none found
 */
export const getScheduledTripByKey = internalQuery({
  args: {
    key: v.string(),
  },
  returns: v.union(scheduledTripSchema, v.null()),
  handler: async (ctx, args) => {
    try {
      const matchingTrip = await ctx.db
        .query("scheduledTrips")
        .withIndex("by_key", (q) => q.eq("Key", args.key))
        .first();

      return matchingTrip ? stripConvexMeta(matchingTrip) : null;
    } catch (error) {
      throw new ConvexError({
        message: "Failed to find scheduled trip by key",
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
 * Find the next direct scheduled trip for a vessel leaving a terminal at or
 * after a given arrival moment.
 *
 * Used when a vessel arrives at dock before the live feed exposes the next
 * trip's `ScheduledDeparture` / `ArrivingTerminalAbbrev`.
 *
 * @param ctx - Convex context
 * @param args.vesselAbbrev - Vessel abbreviation
 * @param args.departingTerminalAbbrev - Current dock terminal abbreviation
 * @param args.arrivalTime - Observed arrival/rollover timestamp in epoch ms
 * @returns Matching scheduled trip, or null if none found across the current or next sailing day
 */
export const getNextScheduledTripForVesselAtTerminal = internalQuery({
  args: {
    vesselAbbrev: v.string(),
    departingTerminalAbbrev: v.string(),
    arrivalTime: v.number(),
  },
  returns: v.union(scheduledTripSchema, v.null()),
  handler: async (ctx, args) => {
    try {
      const currentSailingDay = getSailingDay(new Date(args.arrivalTime));
      const nextSailingDay = addDays(currentSailingDay, 1);
      const directTrips = (
        await Promise.all(
          [currentSailingDay, nextSailingDay].map((sailingDay) =>
            ctx.db
              .query("scheduledTrips")
              .withIndex("by_vessel_sailing_day_trip_type", (q) =>
                q
                  .eq("VesselAbbrev", args.vesselAbbrev)
                  .eq("SailingDay", sailingDay)
                  .eq("TripType", "direct")
              )
              .collect()
          )
        )
      ).flat();

      const matchingTrip = directTrips
        .filter(
          (trip) =>
            trip.DepartingTerminalAbbrev === args.departingTerminalAbbrev &&
            trip.DepartingTime >= args.arrivalTime
        )
        .sort((a, b) => a.DepartingTime - b.DepartingTime)[0];

      return matchingTrip ? stripConvexMeta(matchingTrip) : null;
    } catch (error) {
      throw new ConvexError({
        message: "Failed to find next scheduled trip for vessel at terminal",
        code: "QUERY_FAILED",
        severity: "error",
        details: {
          vesselAbbrev: args.vesselAbbrev,
          departingTerminalAbbrev: args.departingTerminalAbbrev,
          arrivalTime: args.arrivalTime,
          error: String(error),
        },
      });
    }
  },
});

/**
 * Find the next direct scheduled trip for a vessel leaving a terminal after a
 * known prior scheduled departure.
 *
 * Used during trip rollover after a late arrival so the system can keep the
 * vessel on the delayed "next" trip instead of skipping ahead to a later trip
 * whose scheduled departure happens to be after the observed arrival time.
 *
 * @param ctx - Convex context
 * @param args.vesselAbbrev - Vessel abbreviation
 * @param args.departingTerminalAbbrev - Current dock terminal abbreviation
 * @param args.previousScheduledDeparture - Scheduled departure of the trip that
 * just completed
 * @returns Matching scheduled trip, or null if none found across the current or next sailing day
 */
export const getNextScheduledTripForVesselAtTerminalAfterDeparture =
  internalQuery({
    args: {
      vesselAbbrev: v.string(),
      departingTerminalAbbrev: v.string(),
      previousScheduledDeparture: v.number(),
    },
    returns: v.union(scheduledTripSchema, v.null()),
    handler: async (ctx, args) => {
      try {
        const currentSailingDay = getSailingDay(
          new Date(args.previousScheduledDeparture)
        );
        const nextSailingDay = addDays(currentSailingDay, 1);
        const directTrips = (
          await Promise.all(
            [currentSailingDay, nextSailingDay].map((sailingDay) =>
              ctx.db
                .query("scheduledTrips")
                .withIndex("by_vessel_sailing_day_trip_type", (q) =>
                  q
                    .eq("VesselAbbrev", args.vesselAbbrev)
                    .eq("SailingDay", sailingDay)
                    .eq("TripType", "direct")
                )
                .collect()
            )
          )
        ).flat();

        const matchingTrip = directTrips
          .filter(
            (trip) =>
              // Use the schedule sequence, not observed arrival time, so a
              // delayed "next" trip is not skipped after a late arrival.
              trip.DepartingTerminalAbbrev === args.departingTerminalAbbrev &&
              trip.DepartingTime > args.previousScheduledDeparture
          )
          .sort((a, b) => a.DepartingTime - b.DepartingTime)[0];

        return matchingTrip ? stripConvexMeta(matchingTrip) : null;
      } catch (error) {
        throw new ConvexError({
          message:
            "Failed to find next scheduled trip after prior departure for vessel at terminal",
          code: "QUERY_FAILED",
          severity: "error",
          details: {
            vesselAbbrev: args.vesselAbbrev,
            departingTerminalAbbrev: args.departingTerminalAbbrev,
            previousScheduledDeparture: args.previousScheduledDeparture,
            error: String(error),
          },
        });
      }
    },
  });

const addDays = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return getSailingDay(date);
};

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
