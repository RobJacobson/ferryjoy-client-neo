/**
 * Synthesizes actual dock rows from current tracking data.
 *
 * Tracking state is a first-class evidence source for reload reconstruction.
 * It runs after durable timestamp sources so history and trip fields win when
 * they already represent the same trip boundary.
 */

import type { DockEventType } from "functions/events/common/schemas";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { buildBoundaryKey, buildSegmentKey } from "shared/keys";
import { getSailingDay } from "shared/time";
import { buildActualDockEventFromWrite } from "../../actual";
import { definedRows } from "../shared";
import type { ReloadScheduledBoundary, ReloadTripWithTripKey } from "../types";
import {
  type ActualDockEventContext,
  buildPhysicalOnlyActualWrite,
} from "./buildActualContext";

type ActualRowsAccumulator = {
  rows: ConvexActualDockEvent[];
  representedTripBoundaryKeys: Set<string>;
};

/**
 * Returns whether a vessel tracking row falls on the requested sailing day.
 *
 * Tracking rows are scoped before schedule-aligned and physical-only projection
 * so off-day state cannot bleed actual evidence into the reload payload.
 *
 * @param tracking - Vessel tracking carrying scheduled departure or ping time
 * @param sailingDay - Target sailing day string from reload inputs
 * @returns True when the tracking row belongs to the requested sailing day
 */
const trackingLocationMatchesSailingDay = (
  tracking: ConvexVesselLocation,
  sailingDay: string
) =>
  getSailingDay(new Date(tracking.ScheduledDeparture ?? tracking.TimeStamp)) ===
  sailingDay;

/**
 * Maps each sailing-day tracking row to schedule-aligned actual rows.
 *
 * Schedule-aligned tracking rows are filtered through the represented boundary
 * set so durable history or trip timestamps keep priority. Current tracking
 * remains authoritative when it is the only evidence source for that boundary.
 *
 * @param options - Filtered tracking rows, updatedAt stamp, reload context, and represented boundary keys
 * @returns Tracking-derived actual rows for scheduled boundaries
 */
const buildScheduleAlignedTrackingActualRows = ({
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
  const scheduleAlignedTrackingAccumulator =
    locations.reduce<ActualRowsAccumulator>(
      (accumulator, tracking) =>
        appendUnrepresentedActualRows(
          accumulator,
          buildScheduleAlignedTrackingRows({
            tracking,
            events: context.eventsByVessel.get(tracking.VesselAbbrev) ?? [],
            updatedAt,
            tripKeyBySegmentKey: context.tripKeyBySegmentKey,
          })
        ),
      {
        rows: [],
        representedTripBoundaryKeys,
      }
    );
  const scheduleAlignedActualRows = scheduleAlignedTrackingAccumulator.rows;

  return scheduleAlignedActualRows;
};

/**
 * Builds schedule-aligned actual rows from one tracking row.
 *
 * @param options - Tracking row, same-vessel boundaries, updatedAt stamp, and TripKey lookup
 * @returns Zero to two rows for departure and arrival candidates tied to the tracking row
 */
const buildScheduleAlignedTrackingRows = ({
  tracking,
  events,
  updatedAt,
  tripKeyBySegmentKey,
}: {
  tracking: ConvexVesselLocation;
  events: ReloadScheduledBoundary[];
  updatedAt: number;
  tripKeyBySegmentKey: Map<string, string>;
}): ConvexActualDockEvent[] => {
  if (events.length === 0 || tracking.InService !== true) {
    return [];
  }

  const departureEvent = getTrackingAnchoredEvent(events, tracking, "dep-dock");
  const arrivalEvent = findArrivalEventForTracking(
    events,
    tracking,
    departureEvent
  );

  /**
   * Builds one schedule-aligned actual row when tracking satisfies boundary guards.
   *
   * @param event - Matched boundary row for this tracking row when found
   * @param eventActualTime - Observed instant from LeftDock or absent for arrival inference
   * @returns Actual dock row or undefined when joins or service flags block emission
   */
  const toScheduleAlignedTrackingRow = (
    event: ReloadScheduledBoundary | undefined,
    eventActualTime: number | undefined
  ) => {
    const tripKey =
      event === undefined
        ? undefined
        : tripKeyBySegmentKey.get(event.SegmentKey);

    if (
      event === undefined ||
      tripKey === undefined ||
      (event.EventType === "dep-dock" &&
        tracking.LeftDock === undefined &&
        tracking.AtDock !== false) ||
      (event.EventType === "arv-dock" && tracking.AtDock !== true)
    ) {
      return undefined;
    }

    const actualDockRowFromScheduleAlignedTracking =
      buildActualDockEventFromWrite(
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

    return actualDockRowFromScheduleAlignedTracking;
  };

  const scheduleAlignedRowsForPing = definedRows([
    toScheduleAlignedTrackingRow(departureEvent, tracking.LeftDock),
    toScheduleAlignedTrackingRow(arrivalEvent, undefined),
  ]);

  return scheduleAlignedRowsForPing;
};

/**
 * Adds physical-only tracking rows for unrepresented TripKey boundaries.
 *
 * Earlier sources may already have emitted rows for the same trip and boundary;
 * the accumulator threads trip-boundary keys through each tracking row so a
 * current state observation never displaces a durable timestamp.
 *
 * @param options - Tracking rows scoped to sailing day, updatedAt stamp, reload context, and represented boundary keys
 * @returns Actual rows from tracking rows whose TripKey boundaries were still unrepresented
 */
const buildPhysicalOnlyTrackingActualRows = ({
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
  const physicalOnlyTrackingAccumulator =
    locations.reduce<ActualRowsAccumulator>(
      (accumulator, tracking) =>
        appendUnrepresentedActualRows(
          accumulator,
          buildPhysicalOnlyTrackingRows({
            tracking,
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
  const physicalOnlyTrackingRows = physicalOnlyTrackingAccumulator.rows;

  return physicalOnlyTrackingRows;
};

/**
 * Builds physical-only actual rows from one tracking row.
 *
 * @param options - Tracking row, active physical-only trip lookup by vessel, and updatedAt stamp
 * @returns Physical-only departure or arrival rows supported by the tracking row
 */
const buildPhysicalOnlyTrackingRows = ({
  tracking,
  updatedAt,
  activePhysicalOnlyTripsByVessel,
}: {
  tracking: ConvexVesselLocation;
  updatedAt: number;
  activePhysicalOnlyTripsByVessel: Map<string, ReloadTripWithTripKey>;
}): ConvexActualDockEvent[] => {
  const trip = activePhysicalOnlyTripsByVessel.get(tracking.VesselAbbrev);

  if (tracking.InService !== true || trip === undefined) {
    return [];
  }

  const departureRow =
    tracking.AtDock === false
      ? buildPhysicalOnlyTrackingRow({
          trip,
          terminalAbbrev: trip.DepartingTerminalAbbrev,
          eventType: "dep-dock",
          eventActualTime: tracking.LeftDock ?? tracking.TimeStamp,
          updatedAt,
        })
      : undefined;
  const arrivalRow =
    tracking.AtDock === true && trip.ArrivingTerminalAbbrev !== undefined
      ? buildPhysicalOnlyTrackingRow({
          trip,
          terminalAbbrev: trip.ArrivingTerminalAbbrev,
          eventType: "arv-dock",
          eventActualTime: tracking.TimeStamp,
          updatedAt,
        })
      : undefined;

  const actualDockRowsFromPhysicalOnlyTracking = definedRows([
    departureRow,
    arrivalRow,
  ]);

  return actualDockRowsFromPhysicalOnlyTracking;
};

/**
 * Materializes one physical-only actual row from trip identity and observed instant.
 *
 * @param options - TripKey-bearing trip, terminal and boundary kind, epoch-ms actual time, updatedAt stamp
 * @returns Validator-shaped actual dock row for the physical-only boundary
 */
const buildPhysicalOnlyTrackingRow = ({
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
  const actualDockRowFromPhysicalOnlyTracking = buildActualDockEventFromWrite(
    physicalOnlyPersistableWrite,
    updatedAt
  );

  return actualDockRowFromPhysicalOnlyTracking;
};

/**
 * Appends candidate rows while tracking composite TripKey boundary keys already emitted.
 *
 * @param accumulator - Prior rows and represented TripKey plus EventType keys
 * @param candidates - New candidate rows from one tracking batch
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
  const mergedRowsAfterAppend = [...accumulator.rows, ...rows];

  return {
    rows: mergedRowsAfterAppend,
    representedTripBoundaryKeys,
  };
};

/**
 * Finds the boundary record matching a tracking row for one event type.
 *
 * @param events - Same-vessel boundary records
 * @param tracking - Vessel tracking row
 * @param eventType - Dock boundary discriminator to match
 * @returns Matching event record or undefined
 */
const getTrackingAnchoredEvent = (
  events: ReloadScheduledBoundary[],
  tracking: ConvexVesselLocation,
  eventType: DockEventType
) => {
  if (tracking.ScheduledDeparture === undefined) {
    return undefined;
  }

  if (tracking.ArrivingTerminalAbbrev !== undefined) {
    const segmentKey = buildSegmentKey(
      tracking.VesselAbbrev,
      tracking.DepartingTerminalAbbrev,
      tracking.ArrivingTerminalAbbrev,
      new Date(tracking.ScheduledDeparture)
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

  const scheduleAnchoredEvent = events.find(
    (event) =>
      event.EventType === eventType &&
      event.ScheduledDeparture === tracking.ScheduledDeparture &&
      (eventType === "arv-dock" ||
        event.TerminalAbbrev === tracking.DepartingTerminalAbbrev)
  );

  return scheduleAnchoredEvent;
};

/**
 * Picks the most recent arrival eligible for the tracking row.
 *
 * @param events - Same-vessel boundary records
 * @param tracking - Vessel tracking row
 * @param departureEvent - Matched departure used to bound scheduled departure
 * @returns Eligible arrival event or undefined
 */
const findArrivalEventForTracking = (
  events: ReloadScheduledBoundary[],
  tracking: ConvexVesselLocation,
  departureEvent: ReloadScheduledBoundary | undefined
) => {
  const scheduledDepartureUpperBound =
    departureEvent?.ScheduledDeparture ?? tracking.ScheduledDeparture;

  if (scheduledDepartureUpperBound === undefined) {
    return undefined;
  }

  return events.reduce<ReloadScheduledBoundary | undefined>((latest, event) => {
    if (
      !isPriorArrivalAtCurrentDock(
        event,
        tracking,
        scheduledDepartureUpperBound
      ) ||
      !arrivalCouldHaveOccurredByPingTime(event, tracking)
    ) {
      return latest;
    }

    return pickLaterScheduledDeparture(latest, event);
  }, undefined);
};

/**
 * Returns whether an event is a prior arrival at the tracking row dock.
 *
 * @param event - Candidate boundary event
 * @param tracking - Vessel tracking row used for terminal matching
 * @param scheduledDepartureUpperBound - Exclusive upper bound for prior arrivals
 * @returns True when the boundary is a prior arrival at the tracking dock
 */
const isPriorArrivalAtCurrentDock = (
  event: ReloadScheduledBoundary,
  tracking: ConvexVesselLocation,
  scheduledDepartureUpperBound: number
): boolean =>
  event.EventType === "arv-dock" &&
  event.TerminalAbbrev === tracking.DepartingTerminalAbbrev &&
  event.ScheduledDeparture < scheduledDepartureUpperBound;

/**
 * Returns whether the tracking row is late enough to infer the arrival boundary.
 *
 * @param event - Candidate arrival boundary
 * @param tracking - Vessel tracking row used for timestamp comparison
 * @returns True when the earliest arrival evidence time is no later than the tracking row
 */
const arrivalCouldHaveOccurredByPingTime = (
  event: ReloadScheduledBoundary,
  tracking: ConvexVesselLocation
): boolean => getEarliestArrivalEvidenceTime(event) <= tracking.TimeStamp;

/**
 * Resolves the earliest timestamp that can make an arrival eligible.
 *
 * @param event - Candidate arrival boundary
 * @returns Earliest scheduled boundary time used by tracking evidence policy
 */
const getEarliestArrivalEvidenceTime = (
  event: ReloadScheduledBoundary
): number =>
  Math.min(
    event.ScheduledDeparture,
    event.EventScheduledTime ?? Number.POSITIVE_INFINITY
  );

/**
 * Picks the candidate with the later scheduled departure.
 *
 * @param latest - Current best eligible arrival
 * @param candidate - Newly eligible arrival candidate
 * @returns Later candidate by scheduled departure
 */
const pickLaterScheduledDeparture = (
  latest: ReloadScheduledBoundary | undefined,
  candidate: ReloadScheduledBoundary
): ReloadScheduledBoundary =>
  latest === undefined ||
  candidate.ScheduledDeparture > latest.ScheduledDeparture
    ? candidate
    : latest;

/**
 * Builds the dedupe set for tracking-derived actual rows.
 *
 * Tracking-derived rows must skip boundaries already covered by history or trip
 * fields. This set captures TripKey plus boundary kind so all tracking sources
 * share the same priority guard.
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
  buildPhysicalOnlyTrackingActualRows,
  buildScheduleAlignedTrackingActualRows,
  buildTripBoundaryKeySet,
  trackingLocationMatchesSailingDay,
};
