/**
 * Query handlers for active and completed vessel trips.
 *
 * Exposes read paths for route, vessel, and sailing-day views, plus the
 * optional schedule join used by trip display surfaces.
 */

import type { Doc } from "_generated/dataModel";
import type { QueryCtx } from "_generated/server";
import { query } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { scheduledTripSchema } from "functions/scheduledTrips/schemas";
import { hydrateStoredTripsWithPredictions } from "functions/vesselTrips/hydrateTripPredictions";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { vesselTripSchema } from "functions/vesselTrips/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";

/**
 * Active trip shape with the optional scheduled-trip join resolved for UI use.
 */
const vesselTripWithScheduledSchema = vesselTripSchema.extend({
  ScheduledTrip: v.optional(scheduledTripSchema),
});

/**
 * Joins `eventsPredicted` ML fields, then strips Convex metadata from each trip.
 */
const stripHydratedTrips = async (
  ctx: Pick<QueryCtx, "db">,
  docs: Doc<"activeVesselTrips">[] | Doc<"completedVesselTrips">[]
): Promise<ConvexVesselTrip[]> => {
  const hydrated = await hydrateStoredTripsWithPredictions(ctx, docs);
  return hydrated.map((h) => stripConvexMeta(h) as ConvexVesselTrip);
};

/**
 * Fetch active vessel trips for a specific route.
 * Used by UnifiedTripsContext to load route-scoped trip data.
 *
 * @param ctx - Convex context
 * @param args.routeAbbrev - Route abbreviation (e.g. "sea-bi")
 * @returns Array of active vessel trips (schema shape) on the given route
 */
export const getActiveTripsByRoute = query({
  args: { routeAbbrev: v.string() },
  returns: v.array(vesselTripSchema),
  handler: async (ctx, args) => {
    try {
      const trips = await ctx.db
        .query("activeVesselTrips")
        .withIndex("by_route_abbrev", (q) =>
          q.eq("RouteAbbrev", args.routeAbbrev)
        )
        .collect();
      return stripHydratedTrips(ctx, trips);
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch active trips for route ${args.routeAbbrev}`,
        code: "QUERY_FAILED",
        severity: "error",
        details: { routeAbbrev: args.routeAbbrev, error: String(error) },
      });
    }
  },
});

/**
 * API function for fetching active vessel trips (currently in progress)
 * Small dataset, frequently updated, perfect for real-time subscriptions
 * Optimized with proper indexing for performance
 *
 * Returns **hydrated** trips (`hydrateStoredTripsWithPredictions`) for API
 * parity with joined `eventsPredicted` fields. `processVesselTrips` loads this
 * query only when the caller does not pass a preloaded list (orchestrator uses
 * storage-native rows from `getOrchestratorTickReadModelInternal` instead).
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
      return stripHydratedTrips(ctx, trips);
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
 * Fetch active vessel trips with joined ScheduledTrip for display.
 *
 * Resolves ScheduledTrip lazily by `ScheduleKey` when schedule alignment exists.
 *
 * @param ctx - Convex context
 * @returns Array of active vessel trips with optional ScheduledTrip appended
 */
export const getActiveTripsWithScheduledTrip = query({
  args: {},
  returns: v.array(vesselTripWithScheduledSchema),
  handler: async (ctx) => {
    try {
      const trips = await ctx.db.query("activeVesselTrips").collect();
      const hydrated = await hydrateStoredTripsWithPredictions(ctx, trips);
      const result = await Promise.all(
        hydrated.map(async (trip) => {
          const stripped = stripConvexMeta(trip);
          const scheduleKey = stripped.ScheduleKey;
          if (!scheduleKey) {
            return stripped;
          }

          const scheduledDoc = await ctx.db
            .query("scheduledTrips")
            .withIndex("by_key", (q) => q.eq("Key", scheduleKey))
            .first();
          const ScheduledTrip = scheduledDoc
            ? stripConvexMeta(scheduledDoc)
            : undefined;
          return { ...stripped, ScheduledTrip };
        })
      );
      return result;
    } catch (error) {
      throw new ConvexError({
        message: "Failed to fetch active vessel trips with scheduled data",
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

      if (!mostRecent) {
        return null;
      }
      const [hydrated] = await hydrateStoredTripsWithPredictions(ctx, [
        mostRecent,
      ]);
      return stripConvexMeta(hydrated);
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
 * Fetch completed vessel trips for a route and trip date (sailing day).
 * Used by UnifiedTripsContext to load route-scoped trip data.
 *
 * @param ctx - Convex context
 * @param args.routeAbbrev - Route abbreviation (e.g. "sea-bi")
 * @param args.tripDate - Sailing day in YYYY-MM-DD format
 * @returns Array of completed vessel trips (schema shape), deduped by TripKey
 */
export const getCompletedTripsByRouteAndTripDate = query({
  args: {
    routeAbbrev: v.string(),
    tripDate: v.string(),
  },
  returns: v.array(vesselTripSchema),
  handler: async (ctx, args) => {
    try {
      const docs = await ctx.db
        .query("completedVesselTrips")
        .withIndex("by_route_abbrev_and_sailing_day", (q) =>
          q.eq("RouteAbbrev", args.routeAbbrev).eq("SailingDay", args.tripDate)
        )
        .collect();
      // Multiple writes for the same physical trip can exist, so collapse by TripKey.
      const byTripKey = new Map<string, (typeof docs)[number]>();
      for (const doc of docs) {
        if (doc.TripKey) byTripKey.set(doc.TripKey, doc);
      }
      return stripHydratedTrips(ctx, Array.from(byTripKey.values()));
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch completed trips for route ${args.routeAbbrev} on ${args.tripDate}`,
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
 * Fetch active vessel trips for multiple routes.
 * Used by UnifiedTripsContext for triangle (f-v-s) and other multi-route views.
 *
 * @param ctx - Convex context
 * @param args.routeAbbrevs - Route abbreviations (e.g. ["f-s", "f-v-s", "s-v"])
 * @returns Array of active vessel trips (schema shape) for the routes
 */
export const getActiveTripsByRoutes = query({
  args: { routeAbbrevs: v.array(v.string()) },
  returns: v.array(vesselTripSchema),
  handler: async (ctx, args) => {
    try {
      const uniqueRoutes = [...new Set(args.routeAbbrevs)];
      const batches = await Promise.all(
        uniqueRoutes.map((routeAbbrev) =>
          ctx.db
            .query("activeVesselTrips")
            .withIndex("by_route_abbrev", (q) =>
              q.eq("RouteAbbrev", routeAbbrev)
            )
            .collect()
        )
      );
      return stripHydratedTrips(ctx, batches.flat());
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch active trips for routes`,
        code: "QUERY_FAILED",
        severity: "error",
        details: {
          routeAbbrevs: args.routeAbbrevs,
          error: String(error),
        },
      });
    }
  },
});

/**
 * Fetch active vessel trips for a specific vessel.
 * Used by vessel-centric timeline views.
 *
 * @param ctx - Convex context
 * @param args.vesselAbbrev - Vessel abbreviation to fetch
 * @returns Array containing the vessel's current active trip, if any
 */
export const getActiveTripsByVessel = query({
  args: { vesselAbbrev: v.string() },
  returns: v.array(vesselTripSchema),
  handler: async (ctx, args) => {
    try {
      const trips = await ctx.db
        .query("activeVesselTrips")
        .withIndex("by_vessel_abbrev", (q) =>
          q.eq("VesselAbbrev", args.vesselAbbrev)
        )
        .collect();

      return stripHydratedTrips(ctx, trips);
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch active trips for vessel ${args.vesselAbbrev}`,
        code: "QUERY_FAILED",
        severity: "error",
        details: {
          vesselAbbrev: args.vesselAbbrev,
          error: String(error),
        },
      });
    }
  },
});

/**
 * Fetch completed vessel trips for multiple routes and trip date.
 * Used by UnifiedTripsContext for triangle (f-v-s) and other multi-route views.
 *
 * @param ctx - Convex context
 * @param args.routeAbbrevs - Route abbreviations (e.g. ["f-s", "f-v-s", "s-v"])
 * @param args.tripDate - Sailing day in YYYY-MM-DD format
 * @returns Array of completed vessel trips (schema shape), deduped by TripKey
 */
export const getCompletedTripsByRoutesAndTripDate = query({
  args: {
    routeAbbrevs: v.array(v.string()),
    tripDate: v.string(),
  },
  returns: v.array(vesselTripSchema),
  handler: async (ctx, args) => {
    try {
      const uniqueRoutes = [...new Set(args.routeAbbrevs)];
      const batches = await Promise.all(
        uniqueRoutes.map((routeAbbrev) =>
          ctx.db
            .query("completedVesselTrips")
            .withIndex("by_route_abbrev_and_sailing_day", (q) =>
              q.eq("RouteAbbrev", routeAbbrev).eq("SailingDay", args.tripDate)
            )
            .collect()
        )
      );
      // Different route batches can still resolve to the same physical trip.
      const byTripKey = new Map<string, (typeof batches)[0][number]>();
      for (const batch of batches) {
        for (const doc of batch) {
          if (doc.TripKey) byTripKey.set(doc.TripKey, doc);
        }
      }
      return stripHydratedTrips(ctx, Array.from(byTripKey.values()));
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch completed trips for routes on ${args.tripDate}`,
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
 * Fetches completed vessel trips for a sailing day and set of departing terminals.
 * Uses indexed lookups only; matches ScheduledTrips usage (sailing day + terminal).
 *
 * @param ctx - Convex context
 * @param args.sailingDay - Sailing day in YYYY-MM-DD format
 * @param args.departingTerminalAbbrevs - Terminal abbreviations to include
 * @returns Array of completed vessel trips (schema shape), deduped by TripKey
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
      // Terminal-scoped queries can overlap, so dedupe by physical TripKey.
      const byTripKey = new Map<string, (typeof results)[0][number]>();
      for (const batch of results) {
        for (const doc of batch) {
          if (doc.TripKey) byTripKey.set(doc.TripKey, doc);
        }
      }
      return stripHydratedTrips(ctx, Array.from(byTripKey.values()));
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

/**
 * Fetch completed vessel trips for a specific vessel and sailing day.
 * Used by vessel-centric timeline views.
 *
 * @param ctx - Convex context
 * @param args.vesselAbbrev - Vessel abbreviation to fetch
 * @param args.sailingDay - Sailing day in YYYY-MM-DD format
 * @returns Array of completed vessel trips for the vessel/day, deduped by TripKey
 */
export const getCompletedTripsByVesselAndSailingDay = query({
  args: {
    vesselAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.array(vesselTripSchema),
  handler: async (ctx, args) => {
    try {
      const docs = await ctx.db
        .query("completedVesselTrips")
        .withIndex("by_vessel_abbrev_and_sailing_day", (q) =>
          q
            .eq("VesselAbbrev", args.vesselAbbrev)
            .eq("SailingDay", args.sailingDay)
        )
        .collect();

      const byTripKey = new Map<string, (typeof docs)[number]>();
      for (const doc of docs) {
        if (doc.TripKey) {
          byTripKey.set(doc.TripKey, doc);
        }
      }

      return stripHydratedTrips(ctx, Array.from(byTripKey.values()));
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch completed trips for vessel ${args.vesselAbbrev} on ${args.sailingDay}`,
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
