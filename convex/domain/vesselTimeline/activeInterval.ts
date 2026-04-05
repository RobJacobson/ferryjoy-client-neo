/**
 * Resolves the active event interval from live vessel identity.
 */

import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";
import type {
  ConvexVesselTimelineActiveInterval,
  ConvexVesselTimelineEvent,
} from "../../functions/vesselTimeline/schemas";
import {
  type AdjacentDockInterval,
  type AdjacentTimelineInterval,
  buildAdjacentTimelineIntervals,
} from "../../shared/timelineIntervals";

/**
 * Resolves the currently active timeline interval from live vessel state and
 * same-day events.
 *
 * The server owns identity inference. The returned interval is boundary-first:
 * it tells the client which event-bounded span is active without exposing row
 * concepts.
 *
 * @param args - Ordered same-day events plus live identity inputs
 * @returns Active event interval, or `null` when none can be proven
 */
export const resolveActiveInterval = ({
  events,
  location,
}: {
  events: ConvexVesselTimelineEvent[];
  location: ConvexVesselLocation | null;
}): ConvexVesselTimelineActiveInterval => {
  if (!location) {
    return null;
  }

  const intervals = buildAdjacentTimelineIntervals(events);

  return location.AtDock
    ? resolveDockInterval(intervals, events, location)
    : resolveSeaInterval(intervals, events, location);
};

const getUniqueMatch = <T>(matches: T[]) =>
  matches.length === 1 ? matches[0] : null;

const toActiveInterval = (
  interval: AdjacentTimelineInterval | null
): ConvexVesselTimelineActiveInterval =>
  interval
    ? {
        kind: interval.kind,
        startEventKey: interval.startEventKey,
        endEventKey: interval.endEventKey,
      }
    : null;

/**
 * Resolves an active at-sea interval from the live segment key.
 *
 * The public timeline read path stays within one sailing day, so the backend
 * only emits an at-sea interval when both boundaries exist in the same-day
 * slice.
 *
 * @param events - Ordered same-day events
 * @param location - Current live vessel-location row
 * @returns Active at-sea interval, or `null`
 */
const resolveSeaInterval = (
  intervals: ReturnType<typeof buildAdjacentTimelineIntervals>,
  events: ConvexVesselTimelineEvent[],
  location: ConvexVesselLocation
): ConvexVesselTimelineActiveInterval => {
  const liveKeyMatch = location.Key
    ? getUniqueMatch(
        intervals.filter(
          (interval) =>
            interval.kind === "at-sea" && interval.segmentKey === location.Key
        )
      )
    : null;

  if (liveKeyMatch) {
    return toActiveInterval(liveKeyMatch);
  }

  const latestDeparture = findLatestCompletedBoundaryEvent(
    events,
    location.TimeStamp,
    {
      eventType: "dep-dock",
      terminalAbbrev: location.DepartingTerminalAbbrev,
    }
  );

  return toActiveInterval(
    latestDeparture
      ? getUniqueMatch(
          intervals.filter(
            (interval) =>
              interval.kind === "at-sea" &&
              interval.startEventKey === latestDeparture.Key
          )
        )
      : null
  );
};

/**
 * Resolves an active at-dock interval from the latest completed arrival at the
 * observed terminal.
 *
 * @param events - Ordered same-day events
 * @param location - Current live vessel-location row
 * @returns Active at-dock interval, or `null`
 */
const resolveDockInterval = (
  intervals: ReturnType<typeof buildAdjacentTimelineIntervals>,
  events: ConvexVesselTimelineEvent[],
  location: ConvexVesselLocation
): ConvexVesselTimelineActiveInterval => {
  const dockTerminal = location.DepartingTerminalAbbrev;
  if (!dockTerminal) {
    return null;
  }

  const dockIntervals = intervals.filter(
    (interval): interval is AdjacentDockInterval =>
      interval.kind === "at-dock" && interval.terminalAbbrev === dockTerminal
  );
  const latestArrival = findLatestCompletedBoundaryEvent(
    events,
    location.TimeStamp,
    {
      eventType: "arv-dock",
      terminalAbbrev: dockTerminal,
    }
  );

  return toActiveInterval(
    latestArrival
      ? getUniqueMatch(
          dockIntervals.filter(
            (interval) => interval.startEventKey === latestArrival.Key
          )
        )
      : getUniqueMatch(
          dockIntervals.filter((interval) => interval.startEventKey === null)
        )
  );
};

const findLatestCompletedBoundaryEvent = (
  events: ConvexVesselTimelineEvent[],
  observedAt: number,
  args: {
    eventType: ConvexVesselTimelineEvent["EventType"];
    terminalAbbrev?: string;
  }
) =>
  [...events]
    .reverse()
    .find(
      (event) =>
        event.EventType === args.eventType &&
        (args.terminalAbbrev === undefined ||
          event.TerminalAbbrev === args.terminalAbbrev) &&
        getBoundaryCompletionTime(event) <= observedAt
    ) ?? null;

const getBoundaryCompletionTime = (event: ConvexVesselTimelineEvent) =>
  event.EventActualTime ?? event.EventScheduledTime ?? event.ScheduledDeparture;
