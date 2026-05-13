/**
 * Builds actual dock rows for schedule-aligned trips from live locations.
 *
 * Reload uses schedule-aligned boundaries as the anchor for most actuals.
 * When history did not surface a depart or arrival timestamp but the latest
 * vessel location says the boundary has been crossed, this module emits a
 * sparse actual write keyed to the matching schedule event so the timeline
 * stays consistent with what the vessel is doing right now.
 */

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

/**
 * Builds actual dock rows that align live locations with hydrated events.
 *
 * Indexes events by vessel, then for each ping derives at most one depart and
 * one arrival write anchored on a matching boundary record. Writes are
 * filtered to those carrying a TripKey from the segment-to-trip index so the
 * persisted eventsActual rows stay reachable through the same TripKey-based
 * joins as the scheduled and physical-only branches.
 *
 * @param args.locations - Vessel locations pre-filtered to the sailing day
 * @param args.events - Hydrated boundary records for correlation
 * @param args.tripBySegmentKey - TripKey lookup keyed by segment key
 * @param args.updatedAt - UpdatedAt stamp for the produced rows
 * @returns Schedule-aligned actual dock rows for the sailing day reload
 */
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

/**
 * Attaches the TripKey for a reload write using the segment-to-trip index.
 *
 * @param write - Reload actual write keyed by segment
 * @param tripBySegmentKey - TripKey lookup keyed by segment key
 * @returns Persistable write with TripKey, or null when no trip resolves
 */
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

/**
 * Resolves the earliest plausible time an arrival boundary becomes eligible.
 *
 * @param event - Arrival boundary record
 * @returns Minimum of scheduled departure, predicted time, or scheduled arrival
 */
const arrivalEligibilityTime = (event: DockStatusEventRecord) =>
  Math.min(
    event.ScheduledDeparture,
    event.EventPredictedTime ?? Number.POSITIVE_INFINITY,
    event.EventScheduledTime ?? Number.POSITIVE_INFINITY
  );

/**
 * Finds the boundary record matching a location ping for one event type.
 *
 * @param events - Same-vessel boundary records
 * @param location - Vessel location ping
 * @param eventType - Dock boundary discriminator to match
 * @returns Matching event record or undefined
 */
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

/**
 * Picks the most recent unactualized arrival eligible for the location ping.
 *
 * @param events - Same-vessel boundary records
 * @param location - Vessel location ping
 * @param departureEvent - Matched departure used to bound scheduled departure
 * @returns Eligible arrival event or undefined
 */
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
    .sort(
      (left, right) => right.ScheduledDeparture - left.ScheduledDeparture
    )[0];
};

/**
 * Builds an actual reload write from one matched event and a location ping.
 *
 * @param location - Vessel location ping
 * @param event - Matched boundary event
 * @param EventActualTime - Observed time in epoch ms when known
 * @returns Reload actual write or undefined when no patch is warranted
 */
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

/**
 * Builds zero to two actual writes for one location and event slice.
 *
 * @param events - Same-vessel boundary records
 * @param location - Vessel location ping
 * @returns Departure and arrival writes when each pair is matched
 */
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
