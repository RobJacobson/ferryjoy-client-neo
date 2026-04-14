/**
 * Applies live vessel-location data to merged boundary events and
 * exposes shared event identity and sorting helpers.
 */

import type { ConvexActualBoundaryPatch } from "../../../functions/eventsActual/schemas";
import type { ConvexVesselLocation } from "../../../functions/vesselLocation/schemas";
import type {
  ConvexVesselTimelineEventRecord,
  VesselTimelineEventType,
} from "../../../functions/vesselTimeline/schemas";
import {
  buildBoundaryKey,
  buildSegmentKey,
  buildVesselSailingDayScopeKey,
} from "../../../shared/keys";

const MOVING_SPEED_THRESHOLD = 0.2;
const DOCKED_SPEED_THRESHOLD = 0.2;
const IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS = 5 * 60 * 1000;
/**
 * Builds sparse `ConvexActualBoundaryPatch` payloads from one live location
 * tick against an ordered vessel/day timeline (same patch shape as trip
 * projection). Used when telemetry proves a boundary without necessarily
 * supplying `EventActualTime`.
 *
 * @param events - Ordered vessel/day timeline events
 * @param location - Current live vessel location
 * @returns Zero or more patches to merge into `eventsActual`
 */
export const buildActualBoundaryPatchesFromLocation = (
  events: ConvexVesselTimelineEventRecord[],
  location: ConvexVesselLocation
): ConvexActualBoundaryPatch[] => {
  if (events.length === 0 || location.InService !== true) {
    return [];
  }

  const { departureEvent, resolvedArrivalEvent } =
    resolveLocationBoundaryEvents(events, location);

  return [
    buildDepartureActualPatchFromLocation(location, departureEvent),
    buildArrivalActualPatchFromLocation(location, resolvedArrivalEvent),
  ].filter((patch): patch is ConvexActualBoundaryPatch => patch !== undefined);
};

/**
 * Sorts vessel trip events into stable timeline order.
 *
 * @param left - First event to compare
 * @param right - Second event to compare
 * @returns Negative when `left` should appear before `right`
 */
export const sortVesselTripEvents = (
  left: ConvexVesselTimelineEventRecord,
  right: ConvexVesselTimelineEventRecord
) =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  getEventTypeOrder(left.EventType) - getEventTypeOrder(right.EventType) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

/**
 * Normalizes a sorted vessel/day event list so identical scheduled arrival and
 * departure boundaries at the same terminal become a real five-minute dock
 * span instead of a zero-length seam.
 *
 * @param events - Sorted vessel/day boundary events
 * @returns Cloned event list with identical dock seams corrected
 */
export const normalizeScheduledDockSeams = (
  events: ConvexVesselTimelineEventRecord[]
): ConvexVesselTimelineEventRecord[] => {
  const adjustedScheduledTimesByKey = new Map<string, number>();
  const eventsByVesselDay = new Map<
    string,
    ConvexVesselTimelineEventRecord[]
  >();

  for (const event of events) {
    const vesselDayKey = buildVesselSailingDayScopeKey(
      event.VesselAbbrev,
      event.SailingDay
    );
    const scopedEvents = eventsByVesselDay.get(vesselDayKey);

    if (scopedEvents) {
      scopedEvents.push(event);
      continue;
    }

    eventsByVesselDay.set(vesselDayKey, [event]);
  }

  for (const scopedEvents of eventsByVesselDay.values()) {
    const sortedScopedEvents = [...scopedEvents].sort(sortVesselTripEvents);

    for (let index = 0; index < sortedScopedEvents.length; index++) {
      const event = sortedScopedEvents[index];
      if (
        event?.EventScheduledTime &&
        isIdenticalScheduledDockSeam(event, sortedScopedEvents[index + 1])
      ) {
        adjustedScheduledTimesByKey.set(
          event.Key,
          event.EventScheduledTime - IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS
        );
      }
    }
  }

  return events.map((event) => {
    const adjustedScheduledTime = adjustedScheduledTimesByKey.get(event.Key);

    return adjustedScheduledTime !== undefined
      ? {
          ...event,
          EventScheduledTime: adjustedScheduledTime,
        }
      : event;
  });
};

/**
 * Detects a zero-length dock seam where an arrival and departure share the
 * same scheduled timestamp at the same terminal.
 *
 * @param current - Current event in sorted order
 * @param next - Next event in sorted order
 * @returns True when the seam should be expanded into a five-minute dock span
 */
const isIdenticalScheduledDockSeam = (
  current: ConvexVesselTimelineEventRecord,
  next: ConvexVesselTimelineEventRecord | undefined
) =>
  next !== undefined &&
  current.EventType === "arv-dock" &&
  next.EventType === "dep-dock" &&
  current.TerminalAbbrev === next.TerminalAbbrev &&
  next.EventScheduledTime !== undefined &&
  current.EventScheduledTime === next.EventScheduledTime;

/**
 * Maps event types to a deterministic sort order.
 *
 * @param eventType - Boundary event type to order
 * @returns `0` for departures and `1` for arrivals
 */
const getEventTypeOrder = (eventType: VesselTimelineEventType) =>
  eventType === "dep-dock" ? 0 : 1;

/**
 * Finds an event by its stable read-model key.
 *
 * @param events - Candidate events to search
 * @param Key - Stable event key to match
 * @returns Matching event when present
 */
const getEventByKey = (
  events: ConvexVesselTimelineEventRecord[],
  Key: string
) => events.find((event) => event.Key === Key);

const canConfirmDepartureFromLocation = (
  location: ConvexVesselLocation,
  event: ConvexVesselTimelineEventRecord | undefined
) =>
  location.InService === true &&
  event !== undefined &&
  event.EventOccurred !== true &&
  (location.LeftDock !== undefined || strongDeparture(location));

const canConfirmArrivalFromLocation = (
  location: ConvexVesselLocation,
  event: ConvexVesselTimelineEventRecord | undefined
) =>
  location.InService === true &&
  event !== undefined &&
  event.EventOccurred !== true &&
  strongArrival(location);

const canWriteDepartureActualFromLocation = (
  location: ConvexVesselLocation,
  event: ConvexVesselTimelineEventRecord | undefined
) =>
  location.InService === true &&
  event !== undefined &&
  strongDeparture(location);

const buildDepartureActualPatchFromLocation = (
  location: ConvexVesselLocation,
  event: ConvexVesselTimelineEventRecord | undefined
) =>
  event && canConfirmDepartureFromLocation(location, event)
    ? sparseActualBoundaryPatchFromEvent(event, location.LeftDock)
    : undefined;

const buildArrivalActualPatchFromLocation = (
  location: ConvexVesselLocation,
  event: ConvexVesselTimelineEventRecord | undefined
) =>
  event && canConfirmArrivalFromLocation(location, event)
    ? sparseActualBoundaryPatchFromEvent(event, undefined)
    : undefined;

const sparseActualBoundaryPatchFromEvent = (
  event: ConvexVesselTimelineEventRecord,
  EventActualTime: number | undefined
): ConvexActualBoundaryPatch => ({
  SegmentKey: event.SegmentKey,
  VesselAbbrev: event.VesselAbbrev,
  SailingDay: event.SailingDay,
  ScheduledDeparture: event.ScheduledDeparture,
  TerminalAbbrev: event.TerminalAbbrev,
  EventType: event.EventType,
  EventOccurred: true,
  EventActualTime,
});

const resolveLocationBoundaryEvents = (
  events: ConvexVesselTimelineEventRecord[],
  location: ConvexVesselLocation
) => {
  const departureEvent = getLocationAnchoredEvent(events, location, "dep-dock");
  const anchoredArrivalEvent = getLocationAnchoredEvent(
    events,
    location,
    "arv-dock"
  );

  return {
    departureEvent,
    anchoredArrivalEvent,
    resolvedArrivalEvent: findArrivalEventForLocation(
      events,
      location,
      departureEvent
    ),
  };
};

/**
 * Resolves the anchored boundary event for a live location using the canonical
 * segment key when available, with a field-based fallback for partial fixtures.
 *
 * @param events - Candidate vessel/day boundary events
 * @param location - Live vessel location currently being applied
 * @param eventType - Boundary event to resolve for the current segment
 * @returns Matching boundary event when one can be found
 */
const getLocationAnchoredEvent = (
  events: ConvexVesselTimelineEventRecord[],
  location: ConvexVesselLocation,
  eventType: VesselTimelineEventType
) => {
  if (location.ScheduledDeparture === undefined) {
    return undefined;
  }

  if (location.ArrivingTerminalAbbrev) {
    const segmentKey = buildSegmentKey(
      location.VesselAbbrev,
      location.DepartingTerminalAbbrev,
      location.ArrivingTerminalAbbrev,
      new Date(location.ScheduledDeparture)
    );

    if (segmentKey) {
      const keyedEvent = getEventByKey(
        events,
        buildBoundaryKey(segmentKey, eventType)
      );

      if (keyedEvent) {
        return keyedEvent;
      }
    }
  }

  return events.find(
    (event) =>
      event.VesselAbbrev === location.VesselAbbrev &&
      event.EventType === eventType &&
      event.ScheduledDeparture === location.ScheduledDeparture &&
      (eventType === "arv-dock" ||
        event.TerminalAbbrev === location.DepartingTerminalAbbrev)
  );
};

const strongDeparture = (location: ConvexVesselLocation) =>
  location.AtDock === false && location.Speed >= MOVING_SPEED_THRESHOLD;

const strongArrival = (location: ConvexVesselLocation) =>
  location.AtDock === true && location.Speed < DOCKED_SPEED_THRESHOLD;

/**
 * Finds the arrival event that should be actualized for the current live
 * location.
 *
 * @param events - Candidate vessel/day boundary events
 * @param location - Live vessel location currently being applied
 * @param departureEvent - Departure row anchored to the location's current
 * scheduled departure, when present
 * @returns The arrival event that should receive an actual time, if any
 */
const findArrivalEventForLocation = (
  events: ConvexVesselTimelineEventRecord[],
  location: ConvexVesselLocation,
  departureEvent: ConvexVesselTimelineEventRecord | undefined
) => {
  const anchoredArrivalEvent = findAnchoredArrivalEvent(
    events,
    location,
    departureEvent
  );

  if (location.ScheduledDeparture !== undefined) {
    return anchoredArrivalEvent &&
      anchoredArrivalEvent.EventOccurred !== true &&
      arrivalEligibilityTime(anchoredArrivalEvent) <= location.TimeStamp
      ? anchoredArrivalEvent
      : undefined;
  }

  if (anchoredArrivalEvent) {
    return anchoredArrivalEvent.EventOccurred !== true &&
      arrivalEligibilityTime(anchoredArrivalEvent) <= location.TimeStamp
      ? anchoredArrivalEvent
      : undefined;
  }

  return [...events]
    .filter(
      (event) =>
        event.EventType === "arv-dock" &&
        event.TerminalAbbrev === location.DepartingTerminalAbbrev &&
        event.EventOccurred !== true &&
        arrivalEligibilityTime(event) <= location.TimeStamp
    )
    .sort(
      (left, right) => right.ScheduledDeparture - left.ScheduledDeparture
    )[0];
};

/**
 * Finds the single arrival row that is immediately before the location's
 * current scheduled departure anchor.
 *
 * Once that anchored row actualizes, older unresolved arrivals must not be
 * backfilled by later docked ticks at the same terminal.
 *
 * @param events - Candidate vessel/day boundary events
 * @param location - Live vessel location currently being applied
 * @param departureEvent - Departure row anchored to the location's current
 * scheduled departure, when present
 * @returns The anchored arrival event, if one can be determined
 */
const findAnchoredArrivalEvent = (
  events: ConvexVesselTimelineEventRecord[],
  location: ConvexVesselLocation,
  departureEvent: ConvexVesselTimelineEventRecord | undefined
) => {
  const scheduledDepartureUpperBound =
    departureEvent?.ScheduledDeparture ?? location.ScheduledDeparture;

  if (scheduledDepartureUpperBound === undefined) {
    return undefined;
  }

  return [...events]
    .filter(
      (event) =>
        event.EventType === "arv-dock" &&
        event.TerminalAbbrev === location.DepartingTerminalAbbrev &&
        event.ScheduledDeparture < scheduledDepartureUpperBound
    )
    .sort(
      (left, right) => right.ScheduledDeparture - left.ScheduledDeparture
    )[0];
};

const arrivalEligibilityTime = (
  event: ConvexVesselTimelineEventRecord
) => {
  return Math.min(
    event.ScheduledDeparture,
    event.EventPredictedTime ?? Number.POSITIVE_INFINITY,
    event.EventScheduledTime ?? Number.POSITIVE_INFINITY
  );
};
