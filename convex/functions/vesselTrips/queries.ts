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
import { loadPredictedRowsGroupedForTrips } from "functions/events/eventsPredicted/queries";
import { scheduledTripSchema } from "functions/scheduledTrips/schemas";
import {
  dedupeTripDocBatchesByTripKey,
  mergeTripsWithPredictions,
} from "functions/vesselTrips/read";
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
 * Enriches trip documents with `eventsPredicted` joins for API responses.
 *
 * Batch-loads predicted rows by sailing-day scope, merges with
 * `mergeTripsWithPredictions`, then strips `_id` / `_creationTime`.
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
 * Lists all active trips with joined prediction fields for API parity.
 *
 * Collects `activeVesselTrips` then runs `enrichTripsForApi`; small enough for
 * realtime subscriptions despite the full table read.
 *
 * @param ctx - Convex query context
 * @returns Active trips (schema shape, no `_id` / `_creationTime`)
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
 * Lists active trips with optional `scheduledTrips` catalog rows joined.
 *
 * Enriches predictions first, then resolves `ScheduledTrip` by `ScheduleKey` when
 * present so UI can show catalog metadata separate from orchestrator continuity.
 *
 * @param ctx - Convex query context
 * @returns Active vessel trips with optional `ScheduledTrip` appended
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
 * Lists active trips across multiple routes by indexed reads per route.
 *
 * Dedupes route args, collects per `by_route_abbrev`, flattens, then enriches
 * predictions for `UnifiedTripsContext` multi-route views.
 *
 * @param ctx - Convex query context
 * @param args.routeAbbrevs - Route abbreviations (e.g. `["f-s", "f-v-s", "s-v"]`)
 * @returns Active vessel trips (schema shape) for the routes
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
 * Lists completed trips for multiple routes on one sailing day.
 *
 * Indexed reads per route, dedupes overlapping `TripKey` values, then enriches
 * predictions for historical multi-route UI.
 *
 * @param ctx - Convex query context
 * @param args.routeAbbrevs - Route abbreviations (e.g. `["f-s", "f-v-s", "s-v"]`)
 * @param args.tripDate - Sailing day in YYYY-MM-DD format
 * @returns Completed vessel trips (schema shape), deduped by `TripKey`
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
