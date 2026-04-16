/**
 * Pure scheduled-segment selection helpers shared by timeline and
 * schedule-backed query code.
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
  ConvexScheduledDockEvent,
} from "../events";

/**
 * Builds the small inferred-segment contract shared by timeline and trip code.
 *
 * @param departureEvent - Departure boundary that anchors the segment
 * @param nextDepartureEvent - Next scheduled departure for continuity fields
 * @returns Portable schedule segment lookup result
 */
export const buildInferredScheduledSegment = (
  departureEvent: ConvexScheduledDockEvent,
  nextDepartureEvent: ConvexScheduledDockEvent | null
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
 * Infers the portable segment contract from one departure event and its
 * already-loaded same-day boundary rows.
 *
 * @param departureEvent - Departure boundary that anchors the segment
 * @param sameDayEvents - Candidate same-day boundary rows
 * @returns Portable schedule segment lookup result
 */
export const inferScheduledSegmentFromDepartureEvent = (
  departureEvent: ConvexScheduledDockEvent,
  sameDayEvents: ConvexScheduledDockEvent[]
): ConvexInferredScheduledSegment =>
  buildInferredScheduledSegment(
    departureEvent,
    findNextDepartureEvent(sameDayEvents, {
      afterTime: departureEvent.ScheduledDeparture,
    })
  );

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
  events: ConvexScheduledDockEvent[],
  boundaryEvent: Pick<ConvexScheduledDockEvent, "Key">
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
  events: ConvexScheduledDockEvent[],
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
    .sort(sortScheduledDockEvents)[0] ?? null;

/**
 * Picks the timestamp used to order or compare scheduled boundaries.
 *
 * @param event - Scheduled boundary with a possible explicit event time
 * @returns Event time when present, otherwise the segment departure time
 */
export const getBoundaryTime = (
  event: Pick<
    ConvexScheduledDockEvent,
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
export const sortScheduledDockEvents = (
  left: ConvexScheduledDockEvent,
  right: ConvexScheduledDockEvent
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
const toAdjacentBoundaryEvent = (event: ConvexScheduledDockEvent) => ({
  Key: event.Key,
  SegmentKey: getSegmentKeyFromBoundaryKey(event.Key),
  TerminalAbbrev: event.TerminalAbbrev,
  EventType: event.EventType,
});

/**
 * Precomputes sorted-event lookups used for interval-based schedule
 * resolution.
 *
 * @param events - Scheduled boundary events for one vessel/day scope
 * @returns Sorted event map plus adjacent dock intervals
 */
const buildScheduledIntervalContext = (events: ConvexScheduledDockEvent[]) => {
  const sortedEvents = [...events].sort(sortScheduledDockEvents);

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
 * @returns Sort rank used by `sortScheduledDockEvents`
 */
const getEventTypeOrder = (eventType: ConvexScheduledDockEvent["EventType"]) =>
  eventType === "arv-dock" ? 0 : 1;
