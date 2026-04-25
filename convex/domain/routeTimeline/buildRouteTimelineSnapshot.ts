/**
 * Pure route timeline read-model builder: merges per-vessel timeline rows and
 * assembles ordered dock visits for a route/day snapshot without Convex IO.
 */

import type {
  ConvexRouteTimelineBoundary,
  ConvexRouteTimelineDockVisit,
  ConvexRouteTimelineScope,
  ConvexRouteTimelineSnapshot,
  ConvexRouteTimelineVessel,
} from "../../functions/routeTimeline";
import type { ConvexVesselTimelineEvent } from "../../functions/vesselTimeline/schemas";
import type { ConvexActualDockEvent } from "../events/actual/schemas";
import type { ConvexPredictedDockEvent } from "../events/predicted/schemas";
import type { ConvexScheduledDockEvent } from "../events/scheduled/schemas";
import { mergeTimelineRows } from "../timelineRows";

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
 * Maps one merged vessel timeline event into a route timeline boundary wire
 * row (no vessel/day/segment departure fields).
 *
 * @param event - Merged backbone event for one vessel/day
 * @returns Boundary shape stored on dock visits
 */
const toRouteTimelineBoundary = (
  event: ConvexVesselTimelineEvent
): ConvexRouteTimelineBoundary => ({
  Key: event.Key,
  SegmentKey: event.SegmentKey,
  TerminalAbbrev: event.TerminalAbbrev,
  EventType: event.EventType,
  EventScheduledTime: event.EventScheduledTime,
  EventPredictedTime: event.EventPredictedTime,
  EventOccurred: event.EventOccurred,
  EventActualTime: event.EventActualTime,
});

/**
 * Builds ordered dock visits from merged boundary events using strict adjacent
 * boundary pairing. Does not merge across terminals or repair invalid seams.
 *
 * @param merged - Ordered merged events for one vessel/day
 * @param vesselAbbrev - Vessel owning these visits
 * @param sailingDay - Operational sailing day string
 * @returns Dock visits in merge order
 */
const mergedEventsToDockVisits = (
  merged: ConvexVesselTimelineEvent[],
  vesselAbbrev: string,
  sailingDay: string
): ConvexRouteTimelineDockVisit[] => {
  const visits: ConvexRouteTimelineDockVisit[] = [];
  const dockVisitKey = (
    arrival: ConvexRouteTimelineBoundary | undefined,
    departure: ConvexRouteTimelineBoundary | undefined
  ) => `${arrival?.Key ?? "none"}::${departure?.Key ?? "none"}`;

  for (let index = 0; index < merged.length; index += 1) {
    const event = merged[index];
    if (!event) {
      continue;
    }

    const terminalAbbrev = event.TerminalAbbrev;
    const boundary = toRouteTimelineBoundary(event);
    const previousEvent = index > 0 ? merged[index - 1] : undefined;
    const nextEvent = merged[index + 1];
    const hasPreviousArrivalPair =
      previousEvent?.EventType === "arv-dock" &&
      previousEvent.TerminalAbbrev === terminalAbbrev;

    if (event.EventType === "arv-dock") {
      if (
        nextEvent?.EventType === "dep-dock" &&
        nextEvent.TerminalAbbrev === terminalAbbrev
      ) {
        const departure = toRouteTimelineBoundary(nextEvent);
        visits.push({
          Key: dockVisitKey(boundary, departure),
          VesselAbbrev: vesselAbbrev,
          SailingDay: sailingDay,
          TerminalAbbrev: terminalAbbrev,
          Arrival: boundary,
          Departure: departure,
        });
        index += 1;
        continue;
      }

      visits.push({
        Key: dockVisitKey(boundary, undefined),
        VesselAbbrev: vesselAbbrev,
        SailingDay: sailingDay,
        TerminalAbbrev: terminalAbbrev,
        Arrival: boundary,
        Departure: undefined,
      });
      continue;
    }

    if (hasPreviousArrivalPair) {
      continue;
    }

    visits.push({
      Key: dockVisitKey(undefined, boundary),
      VesselAbbrev: vesselAbbrev,
      SailingDay: sailingDay,
      TerminalAbbrev: terminalAbbrev,
      Arrival: undefined,
      Departure: boundary,
    });
  }

  return visits;
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
 * `WindowStart` / `WindowEnd` are passed through for Stage 3; visit lists are
 * not clipped in Stage 2.
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
        DockVisits: mergedEventsToDockVisits(merged, vesselAbbrev, SailingDay),
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
