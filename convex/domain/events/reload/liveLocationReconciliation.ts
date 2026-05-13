/**
 * Reconciles live vessel locations into sparse actual dock writes during reload.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { buildBoundaryKey, buildSegmentKey } from "shared/keys";
import { getSailingDay } from "shared/time";
import {
  buildActualDockEventFromWrite,
  type ConvexActualDockWritePersistable,
} from "../actual";
import { groupBy } from "./collections";
import { DOCKED_SPEED_THRESHOLD, MOVING_SPEED_THRESHOLD } from "./constants";
import type {
  ActiveTripForPhysicalActualReconcile,
  DockStatusEventRecord,
  ReloadActualDockWrite,
  TripContextForActualRow,
} from "./types";

const locationMatchesSailingDay =
  (sailingDay: string) => (location: ConvexVesselLocation) =>
    getSailingDay(
      new Date(location.ScheduledDeparture ?? location.TimeStamp)
    ) === sailingDay;

const strongDeparture = (location: ConvexVesselLocation) =>
  location.AtDock === false && location.Speed >= MOVING_SPEED_THRESHOLD;

const strongArrival = (location: ConvexVesselLocation) =>
  location.AtDock === true && location.Speed < DOCKED_SPEED_THRESHOLD;

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

  const candidate = [...events]
    .filter(
      (event) =>
        event.EventType === "arv-dock" &&
        event.TerminalAbbrev === location.DepartingTerminalAbbrev &&
        event.ScheduledDeparture < scheduledDepartureUpperBound &&
        event.EventOccurred !== true &&
        arrivalEligibilityTime(event) <= location.TimeStamp
    )
    .sort(
      (left, right) => right.ScheduledDeparture - left.ScheduledDeparture
    )[0];

  return candidate;
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
      !strongDeparture(location)) ||
    (event.EventType === "arv-dock" && !strongArrival(location))
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

  return [
    buildActualWriteFromLocation(location, departureEvent, location.LeftDock),
    buildActualWriteFromLocation(location, arrivalEvent, undefined),
  ].filter((write): write is ReloadActualDockWrite => write !== undefined);
};

const buildPhysicalOnlyPatchesFromLocation = (
  location: ConvexVesselLocation,
  activeTripsByVesselAbbrev: Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >,
  representedTripBoundaryKeys: Set<string>
): ConvexActualDockWritePersistable[] => {
  if (location.InService !== true) {
    return [];
  }

  const trip = activeTripsByVesselAbbrev.get(location.VesselAbbrev);
  if (!trip || trip.ScheduleKey !== undefined) {
    return [];
  }

  const patches: ConvexActualDockWritePersistable[] = [];

  if (
    !representedTripBoundaryKeys.has(`${trip.TripKey}|dep-dock`) &&
    strongDeparture(location)
  ) {
    patches.push({
      TripKey: trip.TripKey,
      VesselAbbrev: trip.VesselAbbrev,
      SailingDay: trip.SailingDay,
      ScheduledDeparture: trip.ScheduledDeparture,
      TerminalAbbrev: trip.DepartingTerminalAbbrev,
      EventType: "dep-dock",
      EventOccurred: true,
      EventActualTime: location.LeftDock ?? location.TimeStamp,
    });
  }

  if (
    !representedTripBoundaryKeys.has(`${trip.TripKey}|arv-dock`) &&
    strongArrival(location) &&
    trip.ArrivingTerminalAbbrev !== undefined
  ) {
    patches.push({
      TripKey: trip.TripKey,
      VesselAbbrev: trip.VesselAbbrev,
      SailingDay: trip.SailingDay,
      ScheduledDeparture: trip.ScheduledDeparture,
      TerminalAbbrev: trip.ArrivingTerminalAbbrev,
      EventType: "arv-dock",
      EventOccurred: true,
      EventActualTime: location.TimeStamp,
    });
  }

  return patches;
};

/**
 * Builds persisted actual rows from locations when history missed schedule rows.
 *
 * @param args.sailingDay - Target sailing day string
 * @param args.events - Normalized boundary records for correlation
 * @param args.actualRows - Base actual rows from schedule and physical trips
 * @param args.updatedAt - UpdatedAt stamp for new Convex rows
 * @param args.vesselLocations - Latest pings for matching
 * @param args.tripBySegmentKey - TripKey lookup by segment key
 * @param args.activeTripsByVesselAbbrev - Physical-only active trips
 * @returns Extra actual rows to merge into the sailing day reload payload
 */
const buildLiveLocationActualRows = ({
  sailingDay,
  events,
  actualRows,
  updatedAt,
  vesselLocations,
  tripBySegmentKey,
  activeTripsByVesselAbbrev,
}: {
  sailingDay: string;
  events: DockStatusEventRecord[];
  actualRows: ConvexActualDockEvent[];
  updatedAt: number;
  vesselLocations: ConvexVesselLocation[];
  tripBySegmentKey: Map<string, TripContextForActualRow>;
  activeTripsByVesselAbbrev: Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >;
}): ConvexActualDockEvent[] => {
  const eventsByVessel = groupBy(events, (event) => event.VesselAbbrev);
  const scheduleAligned = vesselLocations
    .filter(locationMatchesSailingDay(sailingDay))
    .flatMap((location) =>
      buildActualDockWritesFromLocation(
        eventsByVessel.get(location.VesselAbbrev) ?? [],
        location
      )
    )
    .flatMap((write) => {
      const trip = write.SegmentKey
        ? tripBySegmentKey.get(write.SegmentKey)
        : undefined;

      if (!trip?.TripKey) {
        return [];
      }

      const persistableWrite: ConvexActualDockWritePersistable = {
        ...write,
        TripKey: trip.TripKey,
      };

      return [persistableWrite];
    })
    .map((write) => buildActualDockEventFromWrite(write, updatedAt));
  const representedTripBoundaryKeys = new Set(
    [...actualRows, ...scheduleAligned].map(
      (row) => `${row.TripKey}|${row.EventType}`
    )
  );
  const physicalOnly = vesselLocations
    .filter(locationMatchesSailingDay(sailingDay))
    .flatMap((location) =>
      buildPhysicalOnlyPatchesFromLocation(
        location,
        activeTripsByVesselAbbrev,
        representedTripBoundaryKeys
      )
    )
    .map((write) => buildActualDockEventFromWrite(write, updatedAt));

  return [...scheduleAligned, ...physicalOnly];
};

export { buildLiveLocationActualRows };
