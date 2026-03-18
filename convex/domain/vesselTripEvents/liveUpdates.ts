/**
 * Applies live vessel-location data to the `vesselTripEvents` read model and
 * exposes shared event identity and sorting helpers.
 */
import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";
import type {
  ConvexVesselTripEvent,
  VesselTripEventType,
} from "../../functions/vesselTripEvents/schemas";
import { getSailingDay } from "../../shared/time";

const FALSE_DEPARTURE_UNWIND_WINDOW_MS = 2 * 60 * 1000;
const MOVING_SPEED_THRESHOLD = 0.2;
const DOCKED_SPEED_THRESHOLD = 0.2;

/**
 * Builds the stable key used to reconcile schedule reseeds and live updates
 * against the same logical boundary row.
 *
 * @param SailingDay - Service day associated with the scheduled departure
 * @param VesselAbbrev - Vessel abbreviation for the boundary event
 * @param ScheduledDeparture - Scheduled departure timestamp in epoch ms
 * @param DepartingTerminalAbbrev - Origin terminal abbreviation
 * @param EventType - Boundary event kind to encode into the key
 * @returns Stable read-model key for the vessel trip event
 */
export const buildEventKey = (
  SailingDay: string,
  VesselAbbrev: string,
  ScheduledDeparture: number,
  DepartingTerminalAbbrev: string,
  EventType: VesselTripEventType
) =>
  [
    SailingDay,
    VesselAbbrev,
    formatEventTimestamp(ScheduledDeparture),
    DepartingTerminalAbbrev,
    toEventKeyType(EventType),
  ].join("--");

/**
 * Resolves the sailing day for a live location using scheduled departure when
 * available and the observation timestamp otherwise.
 *
 * @param location - Live vessel location payload from the orchestrator
 * @returns Sailing day used to match location updates to vessel trip events
 */
export const getLocationSailingDay = (location: ConvexVesselLocation) =>
  getSailingDay(new Date(location.ScheduledDeparture ?? location.TimeStamp));

/**
 * Applies one live vessel location update to an ordered set of vessel/day
 * boundary events.
 *
 * @param events - Existing vessel/day boundary events in timeline order
 * @param location - Live vessel location used to enrich predictions and actuals
 * @returns A cloned event array with live prediction and actual fields updated
 */
export const applyLiveLocationToEvents = (
  events: ConvexVesselTripEvent[],
  location: ConvexVesselLocation
): ConvexVesselTripEvent[] => {
  if (events.length === 0) {
    return events;
  }

  const nextEvents = events.map((event) => ({ ...event }));
  const SailingDay = getLocationSailingDay(location);
  const departureEvent = location.ScheduledDeparture
    ? getEventByKey(
        nextEvents,
        buildEventKey(
          SailingDay,
          location.VesselAbbrev,
          location.ScheduledDeparture,
          location.DepartingTerminalAbbrev,
          "dep-dock"
        )
      )
    : undefined;
  const arrivalEvent = location.ScheduledDeparture
    ? getEventByKey(
        nextEvents,
        buildEventKey(
          SailingDay,
          location.VesselAbbrev,
          location.ScheduledDeparture,
          location.DepartingTerminalAbbrev,
          "arv-dock"
        )
      )
    : undefined;

  if (departureEvent && departureEvent.ActualTime === undefined) {
    // While still docked, treat the scheduled departure as the best departure
    // prediction until stronger movement evidence appears.
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

    // Undo a noisy departure signal if the vessel is seen docked again at the
    // same terminal before the paired arrival resolves.
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

/**
 * Sorts vessel trip events into stable timeline order.
 *
 * @param left - First event to compare
 * @param right - Second event to compare
 * @returns Negative when `left` should appear before `right`
 */
export const sortVesselTripEvents = (
  left: ConvexVesselTripEvent,
  right: ConvexVesselTripEvent
) =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  getEventTypeOrder(left.EventType) - getEventTypeOrder(right.EventType) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

/**
 * Maps event types to a deterministic sort order.
 *
 * @param eventType - Boundary event type to order
 * @returns `0` for departures and `1` for arrivals
 */
const getEventTypeOrder = (eventType: VesselTripEventType) =>
  eventType === "dep-dock" ? 0 : 1;

/**
 * Finds an event by its stable read-model key.
 *
 * @param events - Candidate events to search
 * @param Key - Stable event key to match
 * @returns Matching event when present
 */
const getEventByKey = (events: ConvexVesselTripEvent[], Key: string) =>
  events.find((event) => event.Key === Key);

/**
 * Detects a strong departure signal from live location data.
 *
 * @param location - Live vessel location payload
 * @returns True when the vessel appears to have left dock
 */
const isStrongDeparture = (location: ConvexVesselLocation) =>
  location.AtDock === false && location.Speed >= MOVING_SPEED_THRESHOLD;

/**
 * Detects a strong arrival signal from live location data.
 *
 * @param location - Live vessel location payload
 * @returns True when the vessel appears docked at low speed
 */
const isStrongArrival = (location: ConvexVesselLocation) =>
  location.AtDock === true && location.Speed < DOCKED_SPEED_THRESHOLD;

/**
 * Detects a transient false departure that should be unwound.
 *
 * @param location - Current live vessel location payload
 * @param departureEvent - Departure event previously actualized for the trip
 * @param arrivalEvent - Paired arrival event for the same scheduled departure
 * @returns True when a recent departure actual should be cleared
 */
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

/**
 * Finds the most recent eligible unresolved arrival for the observed terminal.
 *
 * @param events - Candidate vessel/day boundary events
 * @param TerminalAbbrev - Terminal that the vessel is currently docked at
 * @param timestamp - Observation timestamp used to test arrival eligibility
 * @returns The arrival event that should receive an actual time, if any
 */
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
        getArrivalEligibilityTime(event) <= timestamp
    )
    .sort(
      (left, right) => right.ScheduledDeparture - left.ScheduledDeparture
    )[0];

/**
 * Determines when an arrival event becomes eligible to receive an actual.
 *
 * @param event - Arrival event under consideration
 * @returns Earliest timestamp at which the arrival can be resolved
 */
const getArrivalEligibilityTime = (event: ConvexVesselTripEvent) => {
  const fallbackTimestamp = event.ScheduledDeparture;

  if (event.PredictedTime !== undefined && event.ScheduledTime !== undefined) {
    // An early prediction can make the arrival eligible before the original
    // schedule, but never later than the best known time.
    return Math.min(event.PredictedTime, event.ScheduledTime);
  }

  return event.PredictedTime ?? event.ScheduledTime ?? fallbackTimestamp;
};

/**
 * Formats a scheduled departure timestamp for use inside a stable event key.
 *
 * @param timestamp - Scheduled departure timestamp in epoch ms
 * @returns ISO timestamp with the `T` separator replaced for key safety
 */
const formatEventTimestamp = (timestamp: number) =>
  new Date(timestamp).toISOString().replace("T", "--");

/**
 * Converts a read-model event type into the compact key suffix.
 *
 * @param eventType - Boundary event type to encode
 * @returns `"dep"` for departures and `"arv"` for arrivals
 */
const toEventKeyType = (eventType: VesselTripEventType) =>
  eventType === "dep-dock" ? "dep" : "arv";
