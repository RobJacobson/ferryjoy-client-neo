import { getSailingDay } from "../../shared/time";
import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";
import type {
  ConvexVesselTripEvent,
  VesselTripEventType,
} from "../../functions/vesselTripEvents/schemas";

const FALSE_DEPARTURE_UNWIND_WINDOW_MS = 2 * 60 * 1000;
const MOVING_SPEED_THRESHOLD = 0.2;
const DOCKED_SPEED_THRESHOLD = 0.2;

export const buildEventId = (
  VesselAbbrev: string,
  ScheduledDeparture: number,
  EventType: VesselTripEventType
) => `${VesselAbbrev}-${ScheduledDeparture}-${EventType}`;

export const getLocationSailingDay = (location: ConvexVesselLocation) =>
  getSailingDay(new Date(location.ScheduledDeparture ?? location.TimeStamp));

export const applyLiveLocationToEvents = (
  events: ConvexVesselTripEvent[],
  location: ConvexVesselLocation
): ConvexVesselTripEvent[] => {
  if (events.length === 0) {
    return events;
  }

  const nextEvents = events.map((event) => ({ ...event }));
  const departureEvent = location.ScheduledDeparture
    ? getEventById(
        nextEvents,
        buildEventId(
          location.VesselAbbrev,
          location.ScheduledDeparture,
          "dep-dock"
        )
      )
    : undefined;
  const arrivalEvent = location.ScheduledDeparture
    ? getEventById(
        nextEvents,
        buildEventId(
          location.VesselAbbrev,
          location.ScheduledDeparture,
          "arv-dock"
        )
      )
    : undefined;

  if (departureEvent && departureEvent.ActualTime === undefined) {
    departureEvent.PredictedTime =
      location.AtDock && location.ScheduledDeparture
        ? location.ScheduledDeparture
        : departureEvent.PredictedTime;
  }

  if (arrivalEvent && arrivalEvent.ActualTime === undefined && location.Eta) {
    arrivalEvent.PredictedTime = location.Eta;
  }

  if (isStrongDeparture(location) && departureEvent) {
    departureEvent.ActualTime = location.LeftDock ?? location.TimeStamp;
  }

  if (isFalseDeparture(location, departureEvent, arrivalEvent)) {
    if (!departureEvent) {
      return nextEvents;
    }
    departureEvent.ActualTime = undefined;
    return nextEvents;
  }

  if (isStrongArrival(location)) {
    const resolvedArrivalEvent = findArrivalEventForTerminal(
      nextEvents,
      location.DepartingTerminalAbbrev,
      location.TimeStamp
    );

    if (resolvedArrivalEvent && resolvedArrivalEvent.ActualTime === undefined) {
      resolvedArrivalEvent.ActualTime = location.TimeStamp;
      resolvedArrivalEvent.PredictedTime = undefined;
    }
  }

  return nextEvents;
};

export const sortVesselTripEvents = (
  left: ConvexVesselTripEvent,
  right: ConvexVesselTripEvent
) =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  getEventTypeOrder(left.EventType) - getEventTypeOrder(right.EventType) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

const getEventTypeOrder = (eventType: VesselTripEventType) =>
  eventType === "dep-dock" ? 0 : 1;

const getEventById = (events: ConvexVesselTripEvent[], EventId: string) =>
  events.find((event) => event.EventId === EventId);

const isStrongDeparture = (location: ConvexVesselLocation) =>
  location.AtDock === false && location.Speed >= MOVING_SPEED_THRESHOLD;

const isStrongArrival = (location: ConvexVesselLocation) =>
  location.AtDock === true && location.Speed < DOCKED_SPEED_THRESHOLD;

const isFalseDeparture = (
  location: ConvexVesselLocation,
  departureEvent: ConvexVesselTripEvent | undefined,
  arrivalEvent: ConvexVesselTripEvent | undefined
) => {
  if (
    !isStrongArrival(location) ||
    !departureEvent?.ActualTime ||
    departureEvent.TerminalAbbrev !== location.DepartingTerminalAbbrev
  ) {
    return false;
  }

  if (arrivalEvent?.ActualTime !== undefined) {
    return false;
  }

  return (
    location.TimeStamp - departureEvent.ActualTime <=
    FALSE_DEPARTURE_UNWIND_WINDOW_MS
  );
};

const findArrivalEventForTerminal = (
  events: ConvexVesselTripEvent[],
  TerminalAbbrev: string,
  timestamp: number
) =>
  [...events]
    .filter(
      (event) =>
        event.EventType === "arv-dock" &&
        event.TerminalAbbrev === TerminalAbbrev &&
        event.ActualTime === undefined &&
        (event.ScheduledTime ??
          event.PredictedTime ??
          event.ScheduledDeparture) <= timestamp
    )
    .sort(
      (left, right) => right.ScheduledDeparture - left.ScheduledDeparture
    )[0];
