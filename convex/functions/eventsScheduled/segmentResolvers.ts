import type {
  ConvexInferredScheduledSegment,
  ConvexScheduledBoundaryEvent,
} from "./schemas";

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

const getBoundaryTime = (
  event: Pick<
    ConvexScheduledBoundaryEvent,
    "EventScheduledTime" | "ScheduledDeparture"
  >
) => event.EventScheduledTime ?? event.ScheduledDeparture;

const sortScheduledBoundaryEvents = (
  left: ConvexScheduledBoundaryEvent,
  right: ConvexScheduledBoundaryEvent
) =>
  getBoundaryTime(left) - getBoundaryTime(right) ||
  getEventTypeOrder(left.EventType) - getEventTypeOrder(right.EventType) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

const getSegmentKeyFromBoundaryKey = (boundaryKey: string) =>
  boundaryKey.replace(/--(?:dep|arv)-dock$/, "");

const getEventTypeOrder = (
  eventType: ConvexScheduledBoundaryEvent["EventType"]
) => (eventType === "arv-dock" ? 0 : 1);
