/**
 * Public read path for scheduled trips used by the app. Other schedule reads use
 * direct `ctx.db` queries in feature modules (e.g. vesselTrips).
 */

import { query } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { scheduledTripSchema } from "functions/scheduledTrips/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";

/**
 * Loads direct scheduled trips for multiple routes on one sailing day.
 *
 * Used by `UnifiedTripsContext` for multi-route views; filters to
 * `TripType === "direct"` after indexed reads per route.
 *
 * @param ctx - Convex query context
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
