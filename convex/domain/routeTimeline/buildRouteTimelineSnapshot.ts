/**
 * Pure route timeline read-model builder: merges per-vessel timeline rows and
 * assembles ordered dock visits for a route/day snapshot without Convex IO.
 */

import type {
  ConvexRouteTimelineScope,
  ConvexRouteTimelineSnapshot,
  ConvexRouteTimelineVessel,
} from "../../functions/routeTimeline";
import type { ConvexActualDockEvent } from "../events/actual/schemas";
import type { ConvexPredictedDockEvent } from "../events/predicted/schemas";
import type { ConvexScheduledDockEvent } from "../events/scheduled/schemas";
import { mergeTimelineRows } from "../timelineRows";
import { mergedEventsToWireDockVisits } from "./mergedEventsToWireDockVisits";

export type BuildRouteTimelineSnapshotScopeInput = {
  VesselAbbrev?: string;
  WindowStart?: number;
  WindowEnd?: number;
};

export type BuildRouteTimelineSnapshotArgs = {
  RouteAbbrev: string;
  SailingDay: string;
  scope: BuildRouteTimelineSnapshotScopeInput;
  scheduledEvents: ConvexScheduledDockEvent[];
  actualEvents: ConvexActualDockEvent[];
  predictedEvents: ConvexPredictedDockEvent[];
};

/**
 * Filters dock rows to the given sailing day.
 *
 * @param events - Scheduled dock events
 * @param sailingDay - Target sailing day
 * @returns Same-day rows only
 */
const scheduledForSailingDay = (
  events: ConvexScheduledDockEvent[],
  sailingDay: string
) => events.filter((event) => event.SailingDay === sailingDay);

/**
 * Filters actual events to sailing day and optional vessel.
 *
 * @param events - Actual dock events
 * @param sailingDay - Target sailing day
 * @param vesselAbbrev - When set, restrict to this vessel
 * @returns Filtered rows
 */
const actualForScope = (
  events: ConvexActualDockEvent[],
  sailingDay: string,
  vesselAbbrev?: string
) =>
  events.filter(
    (event) =>
      event.SailingDay === sailingDay &&
      (vesselAbbrev === undefined || event.VesselAbbrev === vesselAbbrev)
  );

/**
 * Filters predicted events to sailing day and optional vessel.
 *
 * @param events - Predicted dock events
 * @param sailingDay - Target sailing day
 * @param vesselAbbrev - When set, restrict to this vessel
 * @returns Filtered rows
 */
const predictedForScope = (
  events: ConvexPredictedDockEvent[],
  sailingDay: string,
  vesselAbbrev?: string
) =>
  events.filter(
    (event) =>
      event.SailingDay === sailingDay &&
      (vesselAbbrev === undefined || event.VesselAbbrev === vesselAbbrev)
  );

/**
 * Unique vessel abbrevs from scheduled rows, sorted for stable output.
 *
 * @param scheduled - Same-day scheduled events
 * @returns Sorted distinct vessel codes
 */
const vesselAbbrevsFromScheduled = (scheduled: ConvexScheduledDockEvent[]) =>
  [...new Set(scheduled.map((event) => event.VesselAbbrev))].sort((a, b) =>
    a.localeCompare(b)
  );

/**
 * Computes snapshot scope including whether the caller narrowed the query.
 * `WindowStart` / `WindowEnd` are echoed on the wire scope only; this builder
 * does not clip dock visits to those bounds.
 *
 * @param scope - Requested scope fields from the caller
 * @returns Full wire scope with `IsPartial`
 */
const resolveSnapshotScope = (
  scope: BuildRouteTimelineSnapshotScopeInput
): ConvexRouteTimelineScope => ({
  ...scope,
  IsPartial:
    scope.VesselAbbrev !== undefined ||
    scope.WindowStart !== undefined ||
    scope.WindowEnd !== undefined,
});

/**
 * Builds a `ConvexRouteTimelineSnapshot` from already-loaded scheduled, actual,
 * and predicted rows for one route and sailing day. Reuses `mergeTimelineRows`
 * per vessel for overlay semantics. Does not read Convex or clip by time
 * window (window fields are echoed on `Scope` only).
 *
 * @param args - Route/day identity, optional scope narrowing, and event rows
 * @returns Wire snapshot with ordered vessels and dock visits
 */
export const buildRouteTimelineSnapshot = ({
  RouteAbbrev,
  SailingDay,
  scope,
  scheduledEvents,
  actualEvents,
  predictedEvents,
}: BuildRouteTimelineSnapshotArgs): ConvexRouteTimelineSnapshot => {
  const scheduledSameDay = scheduledForSailingDay(scheduledEvents, SailingDay);
  const vesselFilter = scope.VesselAbbrev;
  let vesselAbbrevs = vesselAbbrevsFromScheduled(scheduledSameDay);

  if (vesselFilter !== undefined) {
    vesselAbbrevs = vesselAbbrevs.filter((abbrev) => abbrev === vesselFilter);
  }

  const vessels: ConvexRouteTimelineVessel[] = vesselAbbrevs.map(
    (vesselAbbrev) => {
      const scheduled = scheduledSameDay.filter(
        (event) => event.VesselAbbrev === vesselAbbrev
      );
      const actual = actualForScope(actualEvents, SailingDay, vesselAbbrev);
      const predicted = predictedForScope(
        predictedEvents,
        SailingDay,
        vesselAbbrev
      );
      const merged = mergeTimelineRows({
        scheduledEvents: scheduled,
        actualEvents: actual,
        predictedEvents: predicted,
      });
      return {
        VesselAbbrev: vesselAbbrev,
        DockVisits: mergedEventsToWireDockVisits(
          merged,
          vesselAbbrev,
          SailingDay
        ),
      };
    }
  );

  return {
    RouteAbbrev,
    SailingDay,
    Scope: resolveSnapshotScope(scope),
    Vessels: vessels,
  };
};
