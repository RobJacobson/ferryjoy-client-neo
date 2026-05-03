/**
 * Loads scheduled/actual/predicted dock events for a route and sailing day by
 * discovering vessels from `scheduledTrips`, then indexed per-vessel reads.
 *
 * Vessel membership is route-scoped. Scheduled event rows are narrowed back to
 * route-owned segment keys after per-vessel loads; actual/predicted rows remain
 * full vessel-day inputs so `mergeTimelineRows` can attach matching overlays.
 */

import type { QueryCtx } from "_generated/server";
import { getSegmentKeyFromBoundaryKey } from "domain/timelineRows/scheduledSegmentResolvers";
import { loadActualDockEventsForVesselSailingDay } from "functions/events/eventsActual/queries";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import { loadPredictedDockEventsForVesselSailingDay } from "functions/events/eventsPredicted/queries";
import type { ConvexPredictedDockEvent } from "functions/events/eventsPredicted/schemas";
import { queryScheduledDockEventsForVesselSailingDay } from "functions/events/eventsScheduled/queries";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";

export type LoadRouteTimelineSnapshotInputsArgs = {
  RouteAbbrev: string;
  SailingDay: string;
  VesselAbbrev?: string;
};

export type LoadRouteTimelineSnapshotInputsResult = {
  scheduledEvents: ConvexScheduledDockEvent[];
  actualEvents: ConvexActualDockEvent[];
  predictedEvents: ConvexPredictedDockEvent[];
};

/**
 * Returns distinct vessel codes for one route/day from scheduled trips.
 *
 * Sorts abbreviations lexicographically so downstream merging and UI ordering
 * stay stable across reads.
 *
 * @param trips - Rows from `scheduledTrips` for one route and sailing day
 * @returns Sorted unique `VesselAbbrev` values
 */
const vesselAbbrevsFromScheduledTrips = (
  trips: { VesselAbbrev: string }[]
): string[] =>
  [...new Set(trips.map((t) => t.VesselAbbrev))].sort((a, b) =>
    a.localeCompare(b)
  );

/**
 * Returns segment keys owned by scheduled trips for one route/day.
 *
 * After loading full vessel-day `eventsScheduled` rows, filters back to keys
 * present on this route so unrelated vessel schedule noise is excluded.
 *
 * @param trips - Rows from `scheduledTrips` for one route and sailing day
 * @returns Stable segment keys for route-owned scheduled trips
 */
const segmentKeysFromScheduledTrips = (trips: { Key: string }[]): Set<string> =>
  new Set(trips.map((trip) => trip.Key));

/**
 * Loads scheduled, actual, and predicted dock events for a route timeline build.
 *
 * Discovers vessels from `scheduledTrips`, runs indexed per-vessel reads on the
 * three event tables, narrows scheduled rows to route segment keys, and strips
 * metadata from actual/predicted docs for the domain builder.
 *
 * @param ctx - Convex query context
 * @param args - Route, sailing day, and optional single-vessel filter
 * @returns Scheduled, actual, and predicted rows (metadata stripped) for the
 *   builder
 */
export const loadRouteTimelineSnapshotInputs = async (
  ctx: Pick<QueryCtx, "db">,
  args: LoadRouteTimelineSnapshotInputsArgs
): Promise<LoadRouteTimelineSnapshotInputsResult> => {
  const tripRows = await ctx.db
    .query("scheduledTrips")
    .withIndex("by_route_abbrev_and_sailing_day", (q) =>
      q.eq("RouteAbbrev", args.RouteAbbrev).eq("SailingDay", args.SailingDay)
    )
    .collect();

  let vesselAbbrevs = vesselAbbrevsFromScheduledTrips(tripRows);

  if (args.VesselAbbrev !== undefined) {
    vesselAbbrevs = vesselAbbrevs.includes(args.VesselAbbrev)
      ? [args.VesselAbbrev]
      : [];
  }

  const perVessel = await Promise.all(
    vesselAbbrevs.map(async (vesselAbbrev) => {
      const [scheduled, actual, predicted] = await Promise.all([
        queryScheduledDockEventsForVesselSailingDay(ctx, {
          vesselAbbrev,
          sailingDay: args.SailingDay,
        }),
        loadActualDockEventsForVesselSailingDay(ctx, {
          vesselAbbrev,
          sailingDay: args.SailingDay,
        }),
        loadPredictedDockEventsForVesselSailingDay(ctx, {
          vesselAbbrev,
          sailingDay: args.SailingDay,
        }),
      ]);
      const segmentKeys = segmentKeysFromScheduledTrips(
        tripRows.filter((trip) => trip.VesselAbbrev === vesselAbbrev)
      );
      const routeScheduled = scheduled.filter((event) =>
        segmentKeys.has(getSegmentKeyFromBoundaryKey(event.Key))
      );

      return {
        scheduled: routeScheduled,
        actual: actual.map(stripConvexMeta),
        predicted: predicted.map(stripConvexMeta),
      };
    })
  );

  const scheduledEvents: ConvexScheduledDockEvent[] = [];
  const actualEvents: ConvexActualDockEvent[] = [];
  const predictedEvents: ConvexPredictedDockEvent[] = [];

  for (const chunk of perVessel) {
    scheduledEvents.push(...chunk.scheduled);
    actualEvents.push(...chunk.actual);
    predictedEvents.push(...chunk.predicted);
  }

  return { scheduledEvents, actualEvents, predictedEvents };
};
