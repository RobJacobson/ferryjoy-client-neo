import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { buildBoundaryKey, buildSegmentKey } from "shared/keys";
import {
  buildActualDockEventFromWrite,
  type ConvexActualDockWritePersistable,
} from "../../actual";
import { groupBy } from "../shared";
import type {
  DockStatusEventRecord,
  ReloadActualDockWrite,
  TripContextForActualRow,
} from "../types";

const buildScheduleAlignedActualRows = ({
  locations,
  events,
  tripBySegmentKey,
  updatedAt,
}: {
  locations: ConvexVesselLocation[];
  events: DockStatusEventRecord[];
  tripBySegmentKey: Map<string, TripContextForActualRow>;
  updatedAt: number;
}): ConvexActualDockEvent[] => {
  const eventsByVessel = groupBy(events, (event) => event.VesselAbbrev);

  return locations
    .flatMap((location) =>
      buildActualDockWritesFromLocation(
        eventsByVessel.get(location.VesselAbbrev) ?? [],
        location
      )
    )
    .map((write) => attachTripKeyFromSegment(write, tripBySegmentKey))
    .filter(
      (write): write is ConvexActualDockWritePersistable => write !== null
    )
    .map((write) => buildActualDockEventFromWrite(write, updatedAt));
};

const attachTripKeyFromSegment = (
  write: ReloadActualDockWrite,
  tripBySegmentKey: Map<string, TripContextForActualRow>
): ConvexActualDockWritePersistable | null => {
  const trip = tripBySegmentKey.get(write.SegmentKey);

  if (!trip?.TripKey) {
    return null;
  }

  return { ...write, TripKey: trip.TripKey };
};

const arrivalEligibilityTime = (event: DockStatusEventRecord) =>
  Math.min(
    event.ScheduledDeparture,
    event.EventPredictedTime ?? Number.POSITIVE_INFINITY,
    event.EventScheduledTime ?? Number.POSITIVE_INFINITY
  );

const getLocationAnchoredEvent = (
  events: DockStatusEventRecord[],
  location: ConvexVesselLocation,
  eventType: DockStatusEventRecord["EventType"]
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
      const keyedEvent = events.find(
        (event) => event.Key === buildBoundaryKey(segmentKey, eventType)
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

const findArrivalEventForLocation = (
  events: DockStatusEventRecord[],
  location: ConvexVesselLocation,
  departureEvent: DockStatusEventRecord | undefined
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
        event.ScheduledDeparture < scheduledDepartureUpperBound &&
        event.EventOccurred !== true &&
        arrivalEligibilityTime(event) <= location.TimeStamp
    )
    .sort((left, right) => right.ScheduledDeparture - left.ScheduledDeparture)
    .at(0);
};

const buildActualWriteFromLocation = (
  location: ConvexVesselLocation,
  event: DockStatusEventRecord | undefined,
  EventActualTime: number | undefined
): ReloadActualDockWrite | undefined => {
  if (
    event === undefined ||
    event.EventOccurred === true ||
    (event.EventType === "dep-dock" &&
      location.LeftDock === undefined &&
      location.AtDock !== false) ||
    (event.EventType === "arv-dock" && location.AtDock !== true)
  ) {
    return undefined;
  }

  return {
    SegmentKey: event.SegmentKey,
    VesselAbbrev: event.VesselAbbrev,
    SailingDay: event.SailingDay,
    ScheduledDeparture: event.ScheduledDeparture,
    TerminalAbbrev: event.TerminalAbbrev,
    EventType: event.EventType,
    EventOccurred: true,
    EventActualTime,
  };
};

const buildActualDockWritesFromLocation = (
  events: DockStatusEventRecord[],
  location: ConvexVesselLocation
): ReloadActualDockWrite[] => {
  if (events.length === 0 || location.InService !== true) {
    return [];
  }

  const departureEvent = getLocationAnchoredEvent(events, location, "dep-dock");
  const arrivalEvent = findArrivalEventForLocation(
    events,
    location,
    departureEvent
  );
  const departureWrite = buildActualWriteFromLocation(
    location,
    departureEvent,
    location.LeftDock
  );
  const arrivalWrite = buildActualWriteFromLocation(
    location,
    arrivalEvent,
    undefined
  );

  return [departureWrite, arrivalWrite].filter(
    (write): write is ReloadActualDockWrite => write !== undefined
  );
};

export { buildScheduleAlignedActualRows };
