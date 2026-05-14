/**
 * Synthesizes actual dock rows from live vessel location pings.
 *
 * Two fallback paths share this module: schedule-aligned rows anchor to a
 * scheduled boundary that still lacks observation evidence, and physical-only
 * rows back-fill active physical-only trips that have no boundary at all. Both
 * paths run after history-hydrated and physical-only-trip rows are emitted so
 * stronger evidence always wins when sources overlap.
 */

import type { DockEventType } from "functions/events/common/schemas";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { buildBoundaryKey, buildSegmentKey } from "shared/keys";
import { getSailingDay } from "shared/time";
import { buildActualDockEventFromWrite } from "../../actual";
import { collectRows, definedRows } from "../shared";
import type { DockStatusEventRecord, ReloadTripWithTripKey } from "../types";
import {
  type ActualDockEventContext,
  buildPhysicalOnlyActualWrite,
} from "./buildActualContext";

type ActualRowsAccumulator = {
  rows: ConvexActualDockEvent[];
  representedTripBoundaryKeys: Set<string>;
};

/**
 * Returns whether a vessel location falls on the requested sailing day calendar label.
 *
 * Used to scope live location pings before either fallback path so off-day pings
 * cannot bleed actual evidence into the reload payload.
 *
 * @param location - Vessel location carrying scheduled departure or ping time
 * @param sailingDay - Target sailing day string from reload inputs
 * @returns True when getSailingDay of the location instant equals sailingDay
 */
const locationMatchesSailingDay = (
  location: ConvexVesselLocation,
  sailingDay: string
) =>
  getSailingDay(new Date(location.ScheduledDeparture ?? location.TimeStamp)) ===
  sailingDay;

/**
 * Maps each sailing-day location ping to schedule-aligned actual rows when eligible.
 *
 * For every same-day ping, looks up boundary records for that vessel and emits
 * a departure or arrival actual row when the ping satisfies dock-state guards
 * and the boundary still has no observation evidence. Output is flat so the
 * composer can merge it before computing the dedupe set for physical-only pings.
 *
 * @param options - Filtered locations, updatedAt stamp, and reload context supplying events per vessel and segment trip keys
 * @returns Flattened actual rows from pings that confirm scheduled boundaries without duplicating stronger sources
 */
const buildScheduleAlignedLocationFallbackRows = ({
  locations,
  updatedAt,
  context,
}: {
  locations: ConvexVesselLocation[];
  updatedAt: number;
  context: ActualDockEventContext;
}): ConvexActualDockEvent[] => {
  const scheduleAlignedActualRows = collectRows(locations, (location) =>
    buildScheduleAlignedLocationRows({
      location,
      events: context.eventsByVessel.get(location.VesselAbbrev) ?? [],
      updatedAt,
      tripKeyBySegmentKey: context.tripKeyBySegmentKey,
    })
  );

  return scheduleAlignedActualRows;
};

/**
 * Builds schedule-aligned actual rows from one live location ping.
 *
 * @param options - Location ping, same-vessel boundary list, updatedAt stamp,
 * tripKeyBySegmentKey join map from segment to TripKey
 * @returns Zero to two rows for departure and arrival candidates tied to the ping
 */
const buildScheduleAlignedLocationRows = ({
  location,
  events,
  updatedAt,
  tripKeyBySegmentKey,
}: {
  location: ConvexVesselLocation;
  events: DockStatusEventRecord[];
  updatedAt: number;
  tripKeyBySegmentKey: Map<string, string>;
}): ConvexActualDockEvent[] => {
  if (events.length === 0 || location.InService !== true) {
    return [];
  }

  const departureEvent = getLocationAnchoredEvent(events, location, "dep-dock");
  const arrivalEvent = findArrivalEventForLocation(
    events,
    location,
    departureEvent
  );

  /**
   * Builds one schedule-aligned actual row when the ping satisfies boundary guards.
   *
   * @param event - Matched boundary row for this ping when found
   * @param eventActualTime - Observed instant from LeftDock or absent for arrival inference
   * @returns Actual dock row or undefined when joins or service flags block emission
   */
  const toScheduleAlignedLocationRow = (
    event: DockStatusEventRecord | undefined,
    eventActualTime: number | undefined
  ) => {
    const tripKey =
      event === undefined
        ? undefined
        : tripKeyBySegmentKey.get(event.SegmentKey);

    if (
      event === undefined ||
      tripKey === undefined ||
      event.EventOccurred === true ||
      (event.EventType === "dep-dock" &&
        location.LeftDock === undefined &&
        location.AtDock !== false) ||
      (event.EventType === "arv-dock" && location.AtDock !== true)
    ) {
      return undefined;
    }

    const actualDockRowFromScheduleAlignedPing = buildActualDockEventFromWrite(
      {
        TripKey: tripKey,
        VesselAbbrev: event.VesselAbbrev,
        SailingDay: event.SailingDay,
        ScheduledDeparture: event.ScheduledDeparture,
        TerminalAbbrev: event.TerminalAbbrev,
        EventType: event.EventType,
        EventOccurred: true,
        EventActualTime: eventActualTime,
      },
      updatedAt
    );

    return actualDockRowFromScheduleAlignedPing;
  };

  const scheduleAlignedRowsForPing = definedRows([
    toScheduleAlignedLocationRow(departureEvent, location.LeftDock),
    toScheduleAlignedLocationRow(arrivalEvent, undefined),
  ]);

  return scheduleAlignedRowsForPing;
};

/**
 * Adds physical-only ping rows only when their TripKey boundary was not already represented.
 *
 * Earlier sources may already have emitted rows for the same trip and boundary;
 * the accumulator threads a Set of trip-boundary keys through each ping so we
 * never emit a weaker physical-only row that competes with a stronger source.
 *
 * @param options - Locations scoped to sailing day, updatedAt stamp, reload context,
 * and boundary keys already claimed by stronger actual sources
 * @returns Actual rows from pings whose TripKey boundaries were still unrepresented
 */
const buildPhysicalOnlyLocationFallbackRows = ({
  locations,
  updatedAt,
  context,
  representedTripBoundaryKeys,
}: {
  locations: ConvexVesselLocation[];
  updatedAt: number;
  context: ActualDockEventContext;
  representedTripBoundaryKeys: Set<string>;
}): ConvexActualDockEvent[] => {
  const physicalOnlyLocationFallbackAccumulator =
    locations.reduce<ActualRowsAccumulator>(
      (accumulator, location) =>
        appendUnrepresentedActualRows(
          accumulator,
          buildPhysicalOnlyLocationRows({
            location,
            updatedAt,
            activePhysicalOnlyTripsByVessel:
              context.activePhysicalOnlyTripsByVessel,
          })
        ),
      {
        rows: [],
        representedTripBoundaryKeys,
      }
    );
  const physicalOnlyLocationFallbackRows =
    physicalOnlyLocationFallbackAccumulator.rows;

  return physicalOnlyLocationFallbackRows;
};

/**
 * Builds physical-only actual rows from one live location ping.
 *
 * @param options - Location ping, active physical-only trip lookup by vessel, updatedAt stamp
 * @returns Physical-only departure or arrival rows supported by the ping
 */
const buildPhysicalOnlyLocationRows = ({
  location,
  updatedAt,
  activePhysicalOnlyTripsByVessel,
}: {
  location: ConvexVesselLocation;
  updatedAt: number;
  activePhysicalOnlyTripsByVessel: Map<string, ReloadTripWithTripKey>;
}): ConvexActualDockEvent[] => {
  const trip = activePhysicalOnlyTripsByVessel.get(location.VesselAbbrev);

  if (location.InService !== true || trip === undefined) {
    return [];
  }

  const departureRow =
    location.AtDock === false
      ? buildPhysicalOnlyLocationRow({
          trip,
          terminalAbbrev: trip.DepartingTerminalAbbrev,
          eventType: "dep-dock",
          eventActualTime: location.LeftDock ?? location.TimeStamp,
          updatedAt,
        })
      : undefined;
  const arrivalRow =
    location.AtDock === true && trip.ArrivingTerminalAbbrev !== undefined
      ? buildPhysicalOnlyLocationRow({
          trip,
          terminalAbbrev: trip.ArrivingTerminalAbbrev,
          eventType: "arv-dock",
          eventActualTime: location.TimeStamp,
          updatedAt,
        })
      : undefined;

  const actualDockRowsFromPhysicalOnlyPing = definedRows([
    departureRow,
    arrivalRow,
  ]);

  return actualDockRowsFromPhysicalOnlyPing;
};

/**
 * Materializes one physical-only actual row from trip identity and observed instant.
 *
 * @param options - TripKey-bearing trip, terminal and boundary kind, epoch-ms actual time, updatedAt stamp
 * @returns Validator-shaped actual dock row for the physical-only boundary
 */
const buildPhysicalOnlyLocationRow = ({
  trip,
  terminalAbbrev,
  eventType,
  eventActualTime,
  updatedAt,
}: {
  trip: ReloadTripWithTripKey;
  terminalAbbrev: string;
  eventType: DockEventType;
  eventActualTime: number;
  updatedAt: number;
}): ConvexActualDockEvent => {
  const physicalOnlyPersistableWrite = buildPhysicalOnlyActualWrite(
    trip,
    terminalAbbrev,
    eventType,
    eventActualTime
  );
  const actualDockRowFromPhysicalOnlyPing = buildActualDockEventFromWrite(
    physicalOnlyPersistableWrite,
    updatedAt
  );

  return actualDockRowFromPhysicalOnlyPing;
};

/**
 * Appends candidate rows while tracking composite TripKey boundary keys already emitted.
 *
 * @param accumulator - Prior rows and represented TripKey plus EventType keys
 * @param candidates - New candidate rows from one ping batch
 * @returns Accumulator with merged rows and expanded represented key set
 */
const appendUnrepresentedActualRows = (
  accumulator: ActualRowsAccumulator,
  candidates: ConvexActualDockEvent[]
): ActualRowsAccumulator => {
  const rows = candidates.filter(
    (row) =>
      !accumulator.representedTripBoundaryKeys.has(toTripBoundaryKey(row))
  );
  const representedTripBoundaryKeys = new Set([
    ...accumulator.representedTripBoundaryKeys,
    ...rows.map(toTripBoundaryKey),
  ]);

  return {
    rows: [...accumulator.rows, ...rows],
    representedTripBoundaryKeys,
  };
};

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
  eventType: DockEventType
) => {
  if (location.ScheduledDeparture === undefined) {
    return undefined;
  }

  if (location.ArrivingTerminalAbbrev !== undefined) {
    const segmentKey = buildSegmentKey(
      location.VesselAbbrev,
      location.DepartingTerminalAbbrev,
      location.ArrivingTerminalAbbrev,
      new Date(location.ScheduledDeparture)
    );
    const keyedEvent =
      segmentKey === undefined
        ? undefined
        : events.find(
            (event) => event.Key === buildBoundaryKey(segmentKey, eventType)
          );

    if (keyedEvent !== undefined) {
      return keyedEvent;
    }
  }

  return events.find(
    (event) =>
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

  return events
    .filter(
      (event) =>
        event.EventType === "arv-dock" &&
        event.TerminalAbbrev === location.DepartingTerminalAbbrev &&
        event.ScheduledDeparture < scheduledDepartureUpperBound &&
        event.EventOccurred !== true &&
        Math.min(
          event.ScheduledDeparture,
          event.EventPredictedTime ?? Number.POSITIVE_INFINITY,
          event.EventScheduledTime ?? Number.POSITIVE_INFINITY
        ) <= location.TimeStamp
    )
    .reduce<DockStatusEventRecord | undefined>(
      (latest, event) =>
        latest === undefined ||
        event.ScheduledDeparture > latest.ScheduledDeparture
          ? event
          : latest,
      undefined
    );
};

/**
 * Builds the dedupe set for live-location fallback rows.
 *
 * @param rows - Actual rows carrying TripKey and EventType fields
 * @returns Set of composite TripKey/EventType boundary keys
 */
const buildTripBoundaryKeySet = (
  rows: ReadonlyArray<{ TripKey: string; EventType: DockEventType }>
): Set<string> => new Set(rows.map(toTripBoundaryKey));

/**
 * Builds a composite TripKey/EventType boundary key.
 *
 * @param row - Actual row identity fields
 * @returns Composite boundary key
 */
const toTripBoundaryKey = (row: {
  TripKey: string;
  EventType: DockEventType;
}) => `${row.TripKey}|${row.EventType}`;

export {
  buildPhysicalOnlyLocationFallbackRows,
  buildScheduleAlignedLocationFallbackRows,
  buildTripBoundaryKeySet,
  locationMatchesSailingDay,
};
