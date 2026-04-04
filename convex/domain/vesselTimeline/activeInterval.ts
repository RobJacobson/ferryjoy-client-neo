/**
 * Resolves the active event interval from live vessel identity.
 */

import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";
import type {
  ConvexVesselTimelineActiveInterval,
  ConvexVesselTimelineEvent,
} from "../../functions/vesselTimeline/schemas";

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

  return location.AtDock
    ? resolveDockInterval(events, location)
    : resolveSeaInterval(events, location);
};

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
  events: ConvexVesselTimelineEvent[],
  location: ConvexVesselLocation
): ConvexVesselTimelineActiveInterval => {
  if (!location.Key) {
    return null;
  }

  const departureEvent = events.find(
    (event) =>
      event.SegmentKey === location.Key && event.EventType === "dep-dock"
  );
  const arrivalEvent = events.find(
    (event) =>
      event.SegmentKey === location.Key && event.EventType === "arv-dock"
  );

  if (!departureEvent || !arrivalEvent) {
    return null;
  }

  return {
    kind: "at-sea",
    startEventKey: departureEvent.Key,
    endEventKey: arrivalEvent.Key,
  };
};

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
  events: ConvexVesselTimelineEvent[],
  location: ConvexVesselLocation
): ConvexVesselTimelineActiveInterval => {
  const dockTerminal = location.DepartingTerminalAbbrev;
  if (!dockTerminal) {
    return null;
  }

  const latestArrival = findLatestArrivalAtTerminal(
    events,
    dockTerminal,
    location.TimeStamp
  );

  if (latestArrival) {
    const departureEvent = findNextDepartureAtTerminal(events, dockTerminal, {
      afterTime: getComparableEventTime(latestArrival),
      inclusive: true,
    });

    if (!departureEvent) {
      return {
        kind: "at-dock",
        startEventKey: latestArrival.Key,
        endEventKey: null,
      };
    }

    return {
      kind: "at-dock",
      startEventKey: latestArrival.Key,
      endEventKey: departureEvent.Key,
    };
  }

  const departureEvent = findNextDepartureAtTerminal(events, dockTerminal, {
    afterTime: location.TimeStamp,
    inclusive: true,
  });

  if (!departureEvent) {
    return null;
  }

  return {
    kind: "at-dock",
    startEventKey: null,
    endEventKey: departureEvent.Key,
  };
};

/**
 * Finds the latest same-terminal arrival not after the live observation.
 *
 * @param events - Ordered same-day events
 * @param terminalAbbrev - Observed dock terminal
 * @param observedAt - Observation timestamp in epoch ms
 * @returns Latest qualifying arrival, or `null`
 */
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

/**
 * Finds the next same-terminal departure after one reference time.
 *
 * @param events - Ordered same-day events
 * @param terminalAbbrev - Observed dock terminal
 * @param args - Lower-bound timestamp and inclusivity
 * @returns Earliest qualifying departure, or `null`
 */
const findNextDepartureAtTerminal = (
  events: ConvexVesselTimelineEvent[],
  terminalAbbrev: string,
  args: {
    afterTime: number;
    inclusive: boolean;
  }
) =>
  events.find(
    (event) =>
      event.EventType === "dep-dock" &&
      event.TerminalAbbrev === terminalAbbrev &&
      compareTimes(
        getComparableEventTime(event),
        args.afterTime,
        args.inclusive
      )
  ) ?? null;

/**
 * Picks the timestamp used to compare events against the live observation.
 *
 * Display-time precedence keeps the active attachment aligned with how the
 * timeline already interprets boundary times in the UI.
 *
 * @param event - Timeline boundary event
 * @returns Comparable timestamp in epoch ms
 */
const getComparableEventTime = (event: ConvexVesselTimelineEvent) =>
  event.EventActualTime ??
  event.EventPredictedTime ??
  event.EventScheduledTime ??
  event.ScheduledDeparture;

/**
 * Compares one event time against a lower bound.
 *
 * @param eventTime - Event time in epoch ms
 * @param afterTime - Lower-bound timestamp
 * @param inclusive - Whether equality should pass
 * @returns Whether the event satisfies the bound
 */
const compareTimes = (
  eventTime: number,
  afterTime: number,
  inclusive: boolean
) => (inclusive ? eventTime >= afterTime : eventTime > afterTime);
