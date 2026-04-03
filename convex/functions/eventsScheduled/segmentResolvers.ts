/**
 * Pure scheduled-segment selection helpers for dock ownership lookups.
 *
 * The key idea is that "which trip owns the vessel right now?" is answered
 * from the ordered boundary-event sequence, not from proximity to the current
 * clock time.
 */

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
 * The resolver first locates the latest arrival at the observed terminal that
 * is not in the future. That arrival defines the start of the dock interval,
 * and the owning departure is the first departure at the same terminal after
 * that arrival. If no arrival has happened yet, we fall back to the next
 * upcoming departure at the terminal.
 *
 * @param events - Candidate scheduled boundary events across the dock window
 * @param terminalAbbrev - Terminal where the vessel is currently observed
 * @param observedAt - Observation timestamp in epoch ms
 * @returns Owning departure boundary, or `null`
 */
export const findDockedDepartureEvent = (
  events: ConvexScheduledBoundaryEvent[],
  terminalAbbrev: string,
  observedAt: number
) => {
  const sortedEvents = [...events].sort(sortScheduledBoundaryEvents);
  const latestArrival = [...sortedEvents]
    .reverse()
    .find(
      (event) =>
        event.EventType === "arv-dock" &&
        event.TerminalAbbrev === terminalAbbrev &&
        getBoundaryTime(event) <= observedAt
    );

  if (latestArrival) {
    return (
      sortedEvents.find(
        (event) =>
          event.EventType === "dep-dock" &&
          event.TerminalAbbrev === terminalAbbrev &&
          getBoundaryTime(event) >= getBoundaryTime(latestArrival)
      ) ?? null
    );
  }

  return findNextDepartureEvent(events, {
    terminalAbbrev,
    afterTime: observedAt,
  });
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
  boundaryEvent: Pick<
    ConvexScheduledBoundaryEvent,
    "EventScheduledTime" | "ScheduledDeparture"
  >
) =>
  findNextDepartureEvent(events, {
    afterTime: getBoundaryTime(boundaryEvent),
  });

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
 * Maps event types to their stable sort rank.
 *
 * @param eventType - Boundary event type
 * @returns Sort rank used by `sortScheduledBoundaryEvents`
 */
const getEventTypeOrder = (
  eventType: ConvexScheduledBoundaryEvent["EventType"]
) => (eventType === "arv-dock" ? 0 : 1);
