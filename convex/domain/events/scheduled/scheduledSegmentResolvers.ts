/**
 * Resolves scheduled trip segments from ordered scheduled dock events.
 *
 * Trip ownership and continuity are derived from ordered boundary events rather
 * than wall-clock proximity to now.
 */

import type {
  ConvexInferredScheduledSegment,
  ConvexScheduledDockEvent,
} from "../scheduled";
import {
  type AdjacentDockInterval,
  buildAdjacentBoundaryIntervals,
} from "./adjacentBoundaryIntervals";

/**
 * Builds the portable inferred-segment contract shared across schedule readers.
 *
 * NextKey and NextDepartingTime come from the following dep-dock when present so
 * carousel and map code can chain trips without joining trip tables.
 *
 * @param departureEvent - Departure boundary that anchors the segment
 * @param nextDepartureEvent - Following departure on the same calendar day, if any
 * @returns ConvexInferredScheduledSegment for lookups and UI continuity
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
 * Infers segment continuity from one departure plus its same-day event bag.
 *
 * Walks forward to the chronologically next departure after this rows scheduled
 * departure so callers only pass the full slice once per inference.
 *
 * @param departureEvent - Departure boundary that anchors the segment
 * @param sameDayEvents - All scheduled boundaries for that vessel and sailing day
 * @returns Inferred segment including optional next departure linkage
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
 * Finds the departure event immediately after a given boundary in dock-interval order.
 *
 * Converts boundaries into adjacent at-dock intervals, then finds the interval
 * whose start equals the boundary Key and reads its end event when that end is
 * a departure. This mirrors graph-like traversal without materializing trips.
 *
 * @param events - Candidate scheduled boundary events for one vessel/day
 * @param boundaryEvent - Boundary Key whose succeeding departure is requested
 * @returns Next departure row after that dock interval, or null when none exists
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
 * Finds the chronologically next departure after a time threshold.
 *
 * Optionally scopes to one terminal so berth-local schedules do not pick up
 * departures from another pier on the same sailing day list.
 *
 * @param events - Candidate scheduled boundary events
 * @param args.terminalAbbrev - When set, restricts to departures from that terminal
 * @param args.afterTime - Exclusive lower bound on ScheduledDeparture ordering time
 * @returns Earliest qualifying departure, or null when none exists
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
 * Selects the comparable instant used when sorting or comparing scheduled boundaries.
 *
 * Prefer explicit EventScheduledTime when carriers publish event-specific times;
 * otherwise fall back to ScheduledDeparture anchor so mixed feeds stay ordered.
 *
 * @param event - Scheduled dock boundary subset carrying ordering fields
 * @returns Epoch milliseconds used as the timeline comparison instant
 */
export const getBoundaryTime = (
  event: Pick<
    ConvexScheduledDockEvent,
    "EventScheduledTime" | "ScheduledDeparture"
  >
) => event.EventScheduledTime ?? event.ScheduledDeparture;

/**
 * Comparator implementing stable vessel-day ordering for scheduled dock rows.
 *
 * Timeline order first, then arrival-before-departure at ties, then terminal
 * string tie-break so lists stay deterministic across environments.
 *
 * @param left - First scheduled boundary in a comparison
 * @param right - Second scheduled boundary in a comparison
 * @returns Negative when left precedes right in timeline order
 */
export const sortScheduledDockEvents = (
  left: ConvexScheduledDockEvent,
  right: ConvexScheduledDockEvent
) =>
  getBoundaryTime(left) - getBoundaryTime(right) ||
  getEventTypeOrder(left.EventType) - getEventTypeOrder(right.EventType) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

/**
 * Strips the trailing dep-dock or arv-dock suffix from a canonical boundary Key.
 *
 * Scheduled boundaries encode SegmentKey plus suffix; continuity helpers need the
 * SegmentKey prefix alone when correlating with segment-shaped rows elsewhere.
 *
 * @param boundaryKey - Full boundary Key including suffix
 * @returns SegmentKey substring without the trailing boundary discriminator
 */
export const getSegmentKeyFromBoundaryKey = (boundaryKey: string) =>
  boundaryKey.replace(/--(?:dep|arv)-dock$/, "");

/**
 * Maps one Convex scheduled row into the slim shape consumed by interval builders.
 *
 * Bridges ConvexScheduledDockEvent to AdjacentBoundaryEvent so structural dock and
 * sea intervals share one normalization path without exposing Convex fields there.
 *
 * @param event - Scheduled boundary row from the database slice
 * @returns AdjacentBoundaryEvent suitable for buildAdjacentBoundaryIntervals
 */
const toAdjacentBoundaryEvent = (event: ConvexScheduledDockEvent) => ({
  Key: event.Key,
  SegmentKey: getSegmentKeyFromBoundaryKey(event.Key),
  TerminalAbbrev: event.TerminalAbbrev,
  EventType: event.EventType,
});

/**
 * Sorts scheduled boundaries once and builds adjacent interval geometry for lookups.
 *
 * Shared by findNextDepartureAfterBoundaryEvent so interval construction stays
 * consistent whenever schedule readers need structural adjacency instead of raw arrays.
 *
 * @param events - Ordered or unordered slice; sorted internally before interval build
 * @returns Keyed row map plus adjacent dock and sea intervals in timeline order
 */
const buildScheduledIntervalContext = (events: ConvexScheduledDockEvent[]) => {
  const sortedEvents = [...events].sort(sortScheduledDockEvents);

  return {
    eventByKey: new Map(sortedEvents.map((event) => [event.Key, event])),
    intervals: buildAdjacentBoundaryIntervals(
      sortedEvents.map(toAdjacentBoundaryEvent)
    ),
  };
};

/**
 * Encodes event-type tie-breaking for sortScheduledDockEvents at identical times.
 *
 * Arrivals rank lower numerically so they sort before departures when timestamps match.
 *
 * @param eventType - dep-dock or arv-dock discriminator
 * @returns Sort rank; lower values sort earlier at equal getBoundaryTime results
 */
const getEventTypeOrder = (eventType: ConvexScheduledDockEvent["EventType"]) =>
  eventType === "arv-dock" ? 0 : 1;
