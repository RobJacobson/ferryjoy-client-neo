/**
 * Pure scheduled-segment selection helpers for dock ownership lookups.
 *
 * The key idea is that "which trip owns the vessel right now?" is answered
 * from the ordered boundary-event sequence, not from proximity to the current
 * clock time.
 */

import {
  type AdjacentDockInterval,
  buildAdjacentTimelineIntervals,
} from "../../shared/timelineIntervals";
import type {
  ConvexInferredScheduledSegment,
  ConvexScheduledBoundaryEvent,
} from "./schemas";

/**
 * Builds the small inferred-segment contract shared by timeline and trip code.
 *
 * @param departureEvent - Departure boundary that anchors the segment
 * @param nextDepartureEvent - Next scheduled departure for continuity fields
 * @returns Portable schedule segment lookup result
 */
export const buildInferredScheduledSegment = (
  departureEvent: ConvexScheduledBoundaryEvent,
  nextDepartureEvent: ConvexScheduledBoundaryEvent | null
): ConvexInferredScheduledSegment => ({
  Key: getSegmentKeyFromBoundaryKey(departureEvent.Key),
  SailingDay: departureEvent.SailingDay,
  DepartingTerminalAbbrev: departureEvent.TerminalAbbrev,
  ArrivingTerminalAbbrev: departureEvent.NextTerminalAbbrev,
  DepartingTime: getBoundaryTime(departureEvent),
  NextKey: nextDepartureEvent
    ? getSegmentKeyFromBoundaryKey(nextDepartureEvent.Key)
    : undefined,
  NextDepartingTime: nextDepartureEvent
    ? getBoundaryTime(nextDepartureEvent)
    : undefined,
});

/**
 * Finds the departure that owns a vessel's current dock interval.
 *
 * The resolver derives structural dock intervals from adjacent ordered events
 * and only returns a departure when exactly one same-terminal dock interval is
 * present in the candidate slice.
 *
 * @param events - Candidate scheduled boundary events across the dock window
 * @param terminalAbbrev - Terminal where the vessel is currently observed
 * @returns Owning departure boundary, or `null`
 */
export const findDockedDepartureEvent = (
  events: ConvexScheduledBoundaryEvent[],
  terminalAbbrev: string
) => {
  const { eventByKey, intervals } = buildScheduledIntervalContext(events);
  const interval = getUniqueMatch(
    intervals.filter(
      (candidate): candidate is AdjacentDockInterval =>
        candidate.kind === "at-dock" &&
        candidate.terminalAbbrev === terminalAbbrev
    )
  );

  return interval?.endEventKey
    ? (eventByKey.get(interval.endEventKey) ?? null)
    : null;
};

/**
 * Finds the earliest departure that follows a specific boundary event.
 *
 * This is the event-only adjacency primitive used by the timeline loader to
 * walk from one boundary into the next trip without consulting trip-shaped
 * tables.
 *
 * @param events - Candidate scheduled boundary events
 * @param boundaryEvent - Boundary event whose successor departure is needed
 * @returns Earliest departure after that boundary, or `null`
 */
export const findNextDepartureAfterBoundaryEvent = (
  events: ConvexScheduledBoundaryEvent[],
  boundaryEvent: Pick<ConvexScheduledBoundaryEvent, "Key">
) => {
  const { eventByKey, intervals } = buildScheduledIntervalContext(events);
  const interval = intervals.find(
    (candidate): candidate is AdjacentDockInterval =>
      candidate.kind === "at-dock" &&
      candidate.startEventKey === boundaryEvent.Key
  );

  return interval?.endEventKey
    ? (eventByKey.get(interval.endEventKey) ?? null)
    : null;
};

/**
 * Finds the earliest departure after a reference time, optionally scoped to a
 * terminal.
 *
 * @param events - Candidate scheduled boundary events
 * @param args - Terminal filter and lower-bound timestamp
 * @returns Earliest matching departure boundary, or `null`
 */
export const findNextDepartureEvent = (
  events: ConvexScheduledBoundaryEvent[],
  args: {
    terminalAbbrev?: string;
    afterTime: number;
  }
) =>
  [...events]
    .filter(
      (event) =>
        event.EventType === "dep-dock" &&
        (args.terminalAbbrev === undefined ||
          event.TerminalAbbrev === args.terminalAbbrev) &&
        event.ScheduledDeparture > args.afterTime
    )
    .sort(sortScheduledBoundaryEvents)[0] ?? null;

/**
 * Picks the timestamp used to order or compare scheduled boundaries.
 *
 * @param event - Scheduled boundary with a possible explicit event time
 * @returns Event time when present, otherwise the segment departure time
 */
export const getBoundaryTime = (
  event: Pick<
    ConvexScheduledBoundaryEvent,
    "EventScheduledTime" | "ScheduledDeparture"
  >
) => event.EventScheduledTime ?? event.ScheduledDeparture;

/**
 * Orders scheduled boundary events in stable timeline order.
 *
 * @param left - Left scheduled boundary event
 * @param right - Right scheduled boundary event
 * @returns Stable comparison result for sorting
 */
export const sortScheduledBoundaryEvents = (
  left: ConvexScheduledBoundaryEvent,
  right: ConvexScheduledBoundaryEvent
) =>
  getBoundaryTime(left) - getBoundaryTime(right) ||
  getEventTypeOrder(left.EventType) - getEventTypeOrder(right.EventType) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

/**
 * Extracts the segment/trip key prefix from a boundary key.
 *
 * @param boundaryKey - Boundary key ending in `--dep-dock` or `--arv-dock`
 * @returns Stable segment key
 */
export const getSegmentKeyFromBoundaryKey = (boundaryKey: string) =>
  boundaryKey.replace(/--(?:dep|arv)-dock$/, "");

/**
 * Maps a scheduled boundary event into the generic adjacent-interval shape.
 *
 * @param event - Scheduled boundary event
 * @returns Generic interval input event
 */
const toAdjacentBoundaryEvent = (event: ConvexScheduledBoundaryEvent) => ({
  Key: event.Key,
  SegmentKey: getSegmentKeyFromBoundaryKey(event.Key),
  TerminalAbbrev: event.TerminalAbbrev,
  EventType: event.EventType,
});

const getUniqueMatch = <T>(matches: T[]) =>
  matches.length === 1 ? matches[0] : null;

const buildScheduledIntervalContext = (
  events: ConvexScheduledBoundaryEvent[]
) => {
  const sortedEvents = [...events].sort(sortScheduledBoundaryEvents);

  return {
    eventByKey: new Map(sortedEvents.map((event) => [event.Key, event])),
    intervals: buildAdjacentTimelineIntervals(
      sortedEvents.map(toAdjacentBoundaryEvent)
    ),
  };
};

/**
 * Maps event types to their stable sort rank.
 *
 * @param eventType - Boundary event type
 * @returns Sort rank used by `sortScheduledBoundaryEvents`
 */
const getEventTypeOrder = (
  eventType: ConvexScheduledBoundaryEvent["EventType"]
) => (eventType === "arv-dock" ? 0 : 1);
