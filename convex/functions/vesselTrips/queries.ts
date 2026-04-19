/**
 * Query handlers for active and completed vessel trips.
 *
 * Exposes multi-route reads used by unified trips, active subscriber reads, and
 * the optional `scheduledTrips` join for vessel UI.
 */

import type { Doc } from "_generated/dataModel";
import type { QueryCtx } from "_generated/server";
import { query } from "_generated/server";
import { ConvexError, v } from "convex/values";
import {
  dedupeTripDocBatchesByTripKey,
  mergeTripsWithPredictions,
} from "domain/vesselOrchestration/updateVesselTrips";
import { loadPredictedRowsGroupedForTrips } from "functions/events/eventsPredicted/queries";
import { scheduledTripSchema } from "functions/scheduledTrips/schemas";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";
import { vesselTripSchema } from "functions/vesselTrips/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";

/**
 * Active trip shape with the optional scheduled-trip join resolved for UI use.
 */
const vesselTripWithScheduledSchema = vesselTripSchema.extend({
  ScheduledTrip: v.optional(scheduledTripSchema),
});

/**
 * Enriches stored trips for API reads, then strips Convex metadata.
 *
 * @param ctx - Query context with database access for prediction enrichment
 * @param docs - Active or completed trip documents read from storage
 * @returns Enriched trip rows without Convex metadata
 */
const enrichTripsForApi = async (
  ctx: Pick<QueryCtx, "db">,
  docs: Doc<"activeVesselTrips">[] | Doc<"completedVesselTrips">[]
): Promise<ConvexVesselTripWithPredictions[]> => {
  const predictedByGroup = await loadPredictedRowsGroupedForTrips(ctx, docs);
  const enriched = mergeTripsWithPredictions(docs, predictedByGroup);
  return enriched.map(
    (trip) => stripConvexMeta(trip) as ConvexVesselTripWithPredictions
  );
};

/**
 * API function for fetching active vessel trips (currently in progress)
 * Small dataset, frequently updated, perfect for real-time subscriptions
 * Optimized with proper indexing for performance
 *
 * Returns trips enriched with joined `eventsPredicted` fields for API parity.
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
      return enrichTripsForApi(ctx, trips);
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
 * Fetch active vessel trips with joined `scheduledTrips` rows for display.
 *
 * Tick-time enrichment uses `eventsScheduled` via `appendFinalSchedule` (see
 * `domain/vesselOrchestration/updateVesselTrips` — `buildTripRuntimeAdapters`)
 * (same wiring as `updateVesselOrchestrator` schedule lookup) for next-leg
 * lifecycle fields. This query joins the persisted schedule catalog for UI only.
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
      const enriched = await enrichTripsForApi(ctx, trips);
      const result = await Promise.all(
        enriched.map(async (trip) => {
          const scheduleKey = trip.ScheduleKey;
          if (!scheduleKey) {
            return trip;
          }

          const scheduledDoc = await ctx.db
            .query("scheduledTrips")
            .withIndex("by_key", (q) => q.eq("Key", scheduleKey))
            .first();
          const ScheduledTrip = scheduledDoc
            ? stripConvexMeta(scheduledDoc)
            : undefined;
          return { ...trip, ScheduledTrip };
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
      return enrichTripsForApi(ctx, batches.flat());
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
      return enrichTripsForApi(ctx, dedupeTripDocBatchesByTripKey(batches));
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
