/**
 * Scheduled, actual, and predicted dock event inputs for route timeline
 * snapshots.
 *
 * Discovers vessels from `scheduledTrips`, runs indexed per-vessel reads,
 * narrows scheduled rows to route segment keys, and strips metadata for the
 * domain builder. Actual and predicted rows stay full vessel-day inputs so
 * `mergeTimelineRows` can attach matching overlays.
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
 * Returns scheduled, actual, and predicted dock events for a route timeline
 * build.
 *
 * Discovers vessels from `scheduledTrips`, runs indexed per-vessel reads on the
 * three event tables, narrows scheduled rows to route segment keys, and strips
 * metadata from actual/predicted docs for the domain builder.
 *
 * @param ctx - Convex query context
 * @param args.RouteAbbrev - Operational route code
 * @param args.SailingDay - Operational sailing day (YYYY-MM-DD)
 * @param args.VesselAbbrev - When set, only this vessel if it has trips on the
 *   route that day
 * @returns Scheduled, actual, and predicted rows (metadata stripped on
 *   actual/predicted) for the builder
 */
const loadRouteTimelineSnapshotInputs = async (
  ctx: Pick<QueryCtx, "db">,
  args: LoadRouteTimelineSnapshotInputsArgs
): Promise<LoadRouteTimelineSnapshotInputsResult> => {
  const tripRows = await ctx.db
    .query("scheduledTrips")
    .withIndex("by_route_abbrev_and_sailing_day", (q) =>
      q.eq("RouteAbbrev", args.RouteAbbrev).eq("SailingDay", args.SailingDay)
    )
    .collect();

  type TripRow = (typeof tripRows)[number];

  const tripsByVesselAbbrev = tripRows.reduce<Record<string, TripRow[]>>(
    (acc, trip) => {
      acc[trip.VesselAbbrev] ??= [];
      acc[trip.VesselAbbrev].push(trip);
      return acc;
    },
    {}
  );

  const vesselAbbrevs = Object.keys(tripsByVesselAbbrev)
    .sort((a, b) => a.localeCompare(b))
    .filter((vesselAbbrev) =>
      args.VesselAbbrev === undefined
        ? true
        : vesselAbbrev === args.VesselAbbrev
    );

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
        tripsByVesselAbbrev[vesselAbbrev] ?? []
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

  return {
    scheduledEvents: perVessel.flatMap((chunk) => chunk.scheduled),
    actualEvents: perVessel.flatMap((chunk) => chunk.actual),
    predictedEvents: perVessel.flatMap((chunk) => chunk.predicted),
  };
};

export { loadRouteTimelineSnapshotInputs };
