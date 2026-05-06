/**
 * Flat scheduled dock-event domain helpers.
 *
 * Static reloads use this module to derive dock-boundary records and persisted
 * scheduled rows from WSF schedule segments. Vessel-trip readers also use the
 * segment resolver helpers for live schedule continuity.
 */

import {
  resolveTerminalById,
  type TerminalIdentity,
  tryResolveVessel,
  type VesselIdentity,
} from "adapters";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import {
  buildBoundaryKey,
  buildSegmentKey,
  buildVesselSailingDayScopeKey,
} from "shared/keys";
import {
  classifyDirectSegments,
  getOfficialCrossingTimeMinutes,
} from "../scheduledTrips";

const IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS = 5 * 60 * 1000;

type DockBoundaryEventRecord = {
  SegmentKey: string;
  Key: string;
  VesselAbbrev: string;
  SailingDay: string;
  ScheduledDeparture: number;
  TerminalAbbrev: string;
  EventType: ConvexScheduledDockEvent["EventType"];
  EventScheduledTime?: number;
  EventPredictedTime?: number;
  EventOccurred?: true;
  EventActualTime?: number;
};

type ConvexInferredScheduledSegment = {
  Key: string;
  SailingDay: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  DepartingTime: number;
  NextKey?: string;
  NextDepartingTime?: number;
};

type EventReloadScheduleSegment = {
  VesselName: string;
  DepartingTerminalID: number;
  ArrivingTerminalID: number;
  DepartingTerminalName: string;
  ArrivingTerminalName: string;
  DepartingTime: number;
  ArrivingTime?: number;
  SailingNotes: string;
  Annotations: string[];
  RouteID: number;
  RouteAbbrev: string;
  SailingDay: string;
};

type RawSeedSegment = {
  Key: string;
  VesselAbbrev: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  DepartingTime: number;
  ArrivingTime?: number;
  SailingDay: string;
  RouteID: number;
  RouteAbbrev: string;
};

/**
 * Builds normalized schedule boundary records from direct WSF schedule segments.
 *
 * @param segments - Numeric reload schedule segments
 * @param vessels - Vessel identity rows used to resolve WSF vessel names
 * @param terminals - Terminal identity rows used to resolve WSF terminal IDs
 * @returns Ordered dep-dock and arv-dock boundary records
 */
const buildScheduledDockEventRecords = (
  segments: EventReloadScheduleSegment[],
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): DockBoundaryEventRecord[] =>
  normalizeScheduledDockSeams(
    getDirectRawSeedSegments(segments, vessels, terminals)
      .flatMap(buildSeedEventsForSegment)
      .sort(sortDockBoundaryEventRecords)
  ).sort(sortDockBoundaryEventRecords);

/**
 * Builds persisted scheduled rows from boundary records.
 *
 * @param events - Boundary records for one reload slice
 * @param updatedAt - Timestamp applied to produced rows
 * @returns eventsScheduled rows ready for table replacement
 */
const buildScheduledDockEvents = (
  events: DockBoundaryEventRecord[],
  updatedAt: number
): ConvexScheduledDockEvent[] => {
  const eventByKey = new Map(events.map((event) => [event.Key, event]));
  const lastArrivalKey =
    [...events].reverse().find((event) => event.EventType === "arv-dock")
      ?.Key ?? null;

  return events.map((event) => ({
    Key: event.Key,
    VesselAbbrev: event.VesselAbbrev,
    SailingDay: event.SailingDay,
    UpdatedAt: updatedAt,
    ScheduledDeparture: event.ScheduledDeparture,
    TerminalAbbrev: event.TerminalAbbrev,
    NextTerminalAbbrev:
      event.EventType === "arv-dock"
        ? event.TerminalAbbrev
        : getNextTerminalAbbrev(event, eventByKey),
    EventType: event.EventType,
    EventScheduledTime: event.EventScheduledTime,
    IsLastArrivalOfSailingDay:
      event.EventType === "arv-dock" && event.Key === lastArrivalKey,
  }));
};

/**
 * Restricts raw route segments to direct physical seed segments.
 *
 * @param segments - Numeric WSF reload schedule segments
 * @param vessels - Vessel identity rows
 * @param terminals - Terminal identity rows
 * @returns Direct schedule seed segments with canonical keys
 */
const getDirectRawSeedSegments = (
  segments: EventReloadScheduleSegment[],
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): RawSeedSegment[] =>
  classifyDirectSegments(
    segments
      .map((segment) => toRawSeedSegment(segment, vessels, terminals))
      .filter((segment): segment is RawSeedSegment => segment !== null)
  ).filter((segment) => segment.TripType === "direct");

/**
 * Infers one scheduled segment from a departure event and same-day rows.
 *
 * @param departureEvent - Departure boundary anchoring the inferred segment
 * @param sameDayEvents - Scheduled rows for the same vessel and sailing day
 * @returns Segment context with optional next departure linkage
 */
const inferScheduledSegmentFromDepartureEvent = (
  departureEvent: ConvexScheduledDockEvent,
  sameDayEvents: ConvexScheduledDockEvent[]
): ConvexInferredScheduledSegment => {
  const nextDepartureEvent = findNextDepartureEvent(sameDayEvents, {
    afterTime: departureEvent.ScheduledDeparture,
  });

  return {
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
  };
};

/**
 * Finds the next departure row after a threshold.
 *
 * @param events - Candidate scheduled events
 * @param args.terminalAbbrev - Optional departing terminal filter
 * @param args.afterTime - Exclusive scheduled-departure lower bound
 * @returns Earliest matching departure row, or null when absent
 */
const findNextDepartureEvent = (
  events: ConvexScheduledDockEvent[],
  args: {
    terminalAbbrev?: string;
    afterTime: number;
  }
): ConvexScheduledDockEvent | null =>
  [...events]
    .filter(
      (event) =>
        event.EventType === "dep-dock" &&
        (args.terminalAbbrev === undefined ||
          event.TerminalAbbrev === args.terminalAbbrev) &&
        event.ScheduledDeparture > args.afterTime
    )
    .sort(sortScheduledDockEvents)[0] ?? null;

/**
 * Sorts persisted scheduled rows in timeline order.
 *
 * @param left - First scheduled row
 * @param right - Second scheduled row
 * @returns Sort comparator result
 */
const sortScheduledDockEvents = <
  T extends Pick<
    ConvexScheduledDockEvent,
    "EventScheduledTime" | "ScheduledDeparture" | "EventType" | "TerminalAbbrev"
  >,
>(
  left: T,
  right: T
): number =>
  getBoundaryTime(left) - getBoundaryTime(right) ||
  getEventTypeOrder(left.EventType) - getEventTypeOrder(right.EventType) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

/**
 * Sorts transient boundary records in deterministic timeline order.
 *
 * @param left - First boundary record
 * @param right - Second boundary record
 * @returns Sort comparator result
 */
const sortDockBoundaryEventRecords = (
  left: DockBoundaryEventRecord,
  right: DockBoundaryEventRecord
): number =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  getEventTypeOrder(left.EventType) - getEventTypeOrder(right.EventType) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

/**
 * Adjusts equal-time arrival/departure seams inside each vessel-day scope.
 *
 * @param events - Boundary records to normalize
 * @returns Records with arrival seam times nudged earlier where needed
 */
const normalizeScheduledDockSeams = (
  events: DockBoundaryEventRecord[]
): DockBoundaryEventRecord[] => {
  const adjustedScheduledTimesByKey = new Map<string, number>();
  const eventsByVesselDay = new Map<string, DockBoundaryEventRecord[]>();

  for (const event of events) {
    const vesselDayKey = buildVesselSailingDayScopeKey(
      event.VesselAbbrev,
      event.SailingDay
    );
    eventsByVesselDay.set(vesselDayKey, [
      ...(eventsByVesselDay.get(vesselDayKey) ?? []),
      event,
    ]);
  }

  for (const scopedEvents of eventsByVesselDay.values()) {
    const sortedScopedEvents = [...scopedEvents].sort(
      sortDockBoundaryEventRecords
    );

    for (let index = 0; index < sortedScopedEvents.length; index++) {
      const event = sortedScopedEvents[index];
      if (
        event?.EventScheduledTime !== undefined &&
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
      ? { ...event, EventScheduledTime: adjustedScheduledTime }
      : event;
  });
};

/**
 * Extracts the segment portion from a boundary key.
 *
 * @param boundaryKey - Full boundary key ending in dep-dock or arv-dock
 * @returns Segment key without the boundary suffix
 */
const getSegmentKeyFromBoundaryKey = (boundaryKey: string): string =>
  boundaryKey.replace(/--(?:dep|arv)-dock$/, "");

/**
 * Resolves the comparable scheduled boundary instant.
 *
 * @param event - Event carrying scheduled boundary fields
 * @returns EventScheduledTime when present, otherwise ScheduledDeparture
 */
const getBoundaryTime = (
  event: Pick<
    ConvexScheduledDockEvent,
    "EventScheduledTime" | "ScheduledDeparture"
  >
): number => event.EventScheduledTime ?? event.ScheduledDeparture;

/**
 * Expands one direct seed segment into departure and arrival boundary records.
 *
 * @param segment - Direct schedule seed
 * @returns Paired dep-dock and arv-dock records
 */
const buildSeedEventsForSegment = (
  segment: RawSeedSegment
): DockBoundaryEventRecord[] => {
  const scheduledArrival = normalizeScheduledArrivalTime(
    segment.ArrivingTime ?? getOfficialScheduledArrivalTime(segment),
    segment.DepartingTime
  );

  return [
    {
      SegmentKey: segment.Key,
      Key: buildBoundaryKey(segment.Key, "dep-dock"),
      VesselAbbrev: segment.VesselAbbrev,
      SailingDay: segment.SailingDay,
      ScheduledDeparture: segment.DepartingTime,
      TerminalAbbrev: segment.DepartingTerminalAbbrev,
      EventType: "dep-dock",
      EventScheduledTime: segment.DepartingTime,
    },
    {
      SegmentKey: segment.Key,
      Key: buildBoundaryKey(segment.Key, "arv-dock"),
      VesselAbbrev: segment.VesselAbbrev,
      SailingDay: segment.SailingDay,
      ScheduledDeparture: segment.DepartingTime,
      TerminalAbbrev: segment.ArrivingTerminalAbbrev,
      EventType: "arv-dock",
      EventScheduledTime: scheduledArrival,
    },
  ];
};

/**
 * Resolves one reload segment into a direct seed shape.
 *
 * @param segment - Numeric WSF reload schedule segment
 * @param vessels - Vessel identity rows
 * @param terminals - Terminal identity rows
 * @returns Raw seed segment, or null when identity/key resolution fails
 */
const toRawSeedSegment = (
  segment: EventReloadScheduleSegment,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): RawSeedSegment | null => {
  const vessel = tryResolveVessel(segment.VesselName, vessels);
  const departingTerminal = resolveTerminalById(
    segment.DepartingTerminalID,
    terminals
  );
  const arrivingTerminal = resolveTerminalById(
    segment.ArrivingTerminalID,
    terminals
  );

  if (!vessel || !departingTerminal || !arrivingTerminal) {
    return null;
  }

  const key = buildSegmentKey(
    vessel.VesselAbbrev,
    departingTerminal.TerminalAbbrev,
    arrivingTerminal.TerminalAbbrev,
    new Date(segment.DepartingTime)
  );

  if (!key) {
    return null;
  }

  return {
    Key: key,
    VesselAbbrev: vessel.VesselAbbrev,
    DepartingTerminalAbbrev: departingTerminal.TerminalAbbrev,
    ArrivingTerminalAbbrev: arrivingTerminal.TerminalAbbrev,
    DepartingTime: segment.DepartingTime,
    ArrivingTime: segment.ArrivingTime,
    SailingDay: segment.SailingDay,
    RouteID: segment.RouteID,
    RouteAbbrev: segment.RouteAbbrev,
  };
};

/**
 * Resolves the next terminal for a departure boundary.
 *
 * @param event - Boundary record whose next terminal is needed
 * @param eventByKey - Boundary records keyed by Key
 * @returns Arrival terminal for the segment, falling back to current terminal
 */
const getNextTerminalAbbrev = (
  event: DockBoundaryEventRecord,
  eventByKey: Map<string, DockBoundaryEventRecord>
): string => {
  const arrivalKey = buildBoundaryKey(event.SegmentKey, "arv-dock");

  return eventByKey.get(arrivalKey)?.TerminalAbbrev ?? event.TerminalAbbrev;
};

/**
 * Normalizes an arrival time that exactly equals departure.
 *
 * @param scheduledArrival - Candidate arrival time
 * @param scheduledDeparture - Segment departure time
 * @returns Adjusted arrival time, or undefined
 */
const normalizeScheduledArrivalTime = (
  scheduledArrival: number | undefined,
  scheduledDeparture: number
): number | undefined =>
  scheduledArrival !== undefined && scheduledArrival === scheduledDeparture
    ? scheduledArrival - IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS
    : scheduledArrival;

/**
 * Infers official arrival time for segments that omit it.
 *
 * @param segment - Direct seed segment
 * @returns Arrival epoch milliseconds, or undefined when duration is unknown
 */
const getOfficialScheduledArrivalTime = (
  segment: RawSeedSegment
): number | undefined => {
  if (segment.RouteID === 9 && segment.ArrivingTime !== undefined) {
    return segment.ArrivingTime;
  }

  const duration = getOfficialCrossingTimeMinutes({
    routeAbbrev: segment.RouteAbbrev,
    departingTerminalAbbrev: segment.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: segment.ArrivingTerminalAbbrev,
  });

  return duration !== undefined
    ? segment.DepartingTime + duration * 60 * 1000
    : undefined;
};

/**
 * Tests whether adjacent boundaries form an equal-time dock seam.
 *
 * @param current - Current boundary in sorted order
 * @param next - Following boundary, if present
 * @returns True when current arrival and next departure share terminal and time
 */
const isIdenticalScheduledDockSeam = (
  current: DockBoundaryEventRecord,
  next: DockBoundaryEventRecord | undefined
): boolean =>
  next !== undefined &&
  current.EventType === "arv-dock" &&
  next.EventType === "dep-dock" &&
  current.TerminalAbbrev === next.TerminalAbbrev &&
  next.EventScheduledTime !== undefined &&
  current.EventScheduledTime === next.EventScheduledTime;

/**
 * Encodes arrival-before-departure ordering at equal times.
 *
 * @param eventType - Dock boundary event type
 * @returns Sort rank for the event type
 */
const getEventTypeOrder = (
  eventType: ConvexScheduledDockEvent["EventType"]
): number => (eventType === "arv-dock" ? 0 : 1);

export type {
  ConvexInferredScheduledSegment,
  DockBoundaryEventRecord,
  EventReloadScheduleSegment,
};
export {
  buildScheduledDockEventRecords,
  buildScheduledDockEvents,
  findNextDepartureEvent,
  getDirectRawSeedSegments,
  inferScheduledSegmentFromDepartureEvent,
  normalizeScheduledDockSeams,
  sortDockBoundaryEventRecords,
  sortScheduledDockEvents,
};
