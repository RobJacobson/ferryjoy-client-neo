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
    : resolveSeaInterval(intervals, location);
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
  location: ConvexVesselLocation
): ConvexVesselTimelineActiveInterval =>
  toActiveInterval(
    location.Key
      ? getUniqueMatch(
          intervals.filter(
            (interval) =>
              interval.kind === "at-sea" && interval.segmentKey === location.Key
          )
        )
      : null
  );

/**
 * Resolves an active at-dock interval directly from same-day event evidence.
 *
 * Docked attachment is interval-first: the live observation picks an arrival-
 * to-departure span at the observed terminal rather than first inferring a
 * segment key and then converting that key back into an interval.
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

  const candidates = intervals.filter(
    (interval): interval is AdjacentDockInterval =>
      interval.kind === "at-dock" && interval.terminalAbbrev === dockTerminal
  );
  const eventByKey = new Map(events.map((event) => [event.Key, event]));
  const latestArrival = findLatestArrivalAtTerminal(
    events,
    dockTerminal,
    location.TimeStamp
  );
  const latestArrivalMatch = latestArrival
    ? getUniqueMatch(
        candidates.filter(
          (candidate) => candidate.startEventKey === latestArrival.Key
        )
      )
    : getUniqueMatch(
        candidates.filter((candidate) => {
          if (candidate.startEventKey !== null) {
            return false;
          }

          const endEvent = candidate.endEventKey
            ? eventByKey.get(candidate.endEventKey)
            : null;

          return (
            endEvent !== null &&
            endEvent !== undefined &&
            getComparableEventTime(endEvent) >= location.TimeStamp
          );
        })
      );
  const match =
    latestArrivalMatch ??
    getUniqueMatch(candidates) ??
    (location.Key
      ? getUniqueMatch(
          candidates.filter(
            (candidate) =>
              candidate.previousSegmentKey === location.Key ||
              candidate.nextSegmentKey === location.Key
          )
        )
      : null);

  return toActiveInterval(match);
};

const findLatestArrivalAtTerminal = (
  events: ConvexVesselTimelineEvent[],
  terminalAbbrev: string,
  observedAt: number
) =>
  [...events]
    .reverse()
    .find(
      (event) =>
        event.EventType === "arv-dock" &&
        event.TerminalAbbrev === terminalAbbrev &&
        getComparableEventTime(event) <= observedAt
    ) ?? null;

const getComparableEventTime = (event: ConvexVesselTimelineEvent) =>
  event.EventActualTime ??
  event.EventPredictedTime ??
  event.EventScheduledTime ??
  event.ScheduledDeparture;
