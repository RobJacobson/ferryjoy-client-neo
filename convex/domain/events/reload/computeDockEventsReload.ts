/**
 * Computes one sailing-day dock-event reload payload from WSF inputs and
 * Convex-side trip and location context.
 */

import {
  resolveScheduleSegment,
  type TerminalIdentity,
  type VesselIdentity,
} from "adapters";
import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import type { DockEventType } from "functions/events/common/schemas";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { buildBoundaryKey, buildSegmentKey } from "shared/keys";
import { getSailingDay } from "shared/time";
import {
  classifyDirectSegments,
  getOfficialCrossingTimeMinutes,
} from "../../scheduledTrips";
import type { ConvexActualDockWritePersistable } from "../actual";
import { buildActualDockEventFromWrite } from "../actual";
import { dedupeActualRowsByEventKey } from "../dedupeActualRows";
import { mapHistoryActualsToEventKeys } from "./mapHistoryActualsToEventKeys";
import type {
  ComputeDockEventsReloadArgs,
  DockEventsReload,
  DockStatusEventRecord,
  RawSeedSegment,
  ReloadTripForActuals,
} from "./types";

type HistoryActualSource = "departure-actual" | "arrival-proxy";

type ReloadTripWithTripKey = ReloadTripForActuals & { TripKey: string };

const IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS = 5 * 60 * 1000;
const DEPARTURE_ACTUAL_REPLACEMENT_THRESHOLD_MS = 3 * 60 * 1000;
const ARRIVAL_PROXY_REPLACEMENT_THRESHOLD_MS = 2 * 60 * 1000;

type TripIndexes = {
  tripKeyBySegmentKey: Map<string, string>;
  activeTripsByVesselAbbrev: Map<string, ReloadTripWithTripKey>;
  physicalOnlyTrips: ReloadTripWithTripKey[];
  physicalOnlyTripKeysToPreserve: Set<string>;
};

/**
 * Builds the dock-events reload payload for one sailing day.
 *
 * The reload has two durable outputs: scheduled rows replace the static
 * sailing-day timetable, and actual rows replace observed boundaries while
 * preserving physical-only trip rows that cannot be tied to schedule. This
 * function keeps that whole transform in one place so each input is read once
 * and the mutation layer only persists the finished payload.
 *
 * @param args - WSF inputs, identity tables, trip context, and updatedAt stamp
 * @returns Scheduled rows, actual rows, and TripKeys to preserve during replace
 */
const computeDockEventsReload = ({
  sailingDay,
  scheduleSegments,
  historyRecords,
  vessels,
  terminals,
  activeTrips,
  completedTrips,
  vesselLocations,
  updatedAt,
}: ComputeDockEventsReloadArgs): DockEventsReload => {
  const tripIndexes = indexTripsForReload(activeTrips, completedTrips);
  const seedSegments = resolveSeedSegments(
    scheduleSegments,
    vessels,
    terminals
  );
  const events = normalizeScheduledDockSeams(
    hydrateScheduledEvents({
      seedSegments,
      historyRecords,
      vessels,
      terminals,
    })
  ).sort(compareDockEventsByTimeline);

  return {
    sailingDay,
    scheduledRows: buildScheduledDockEvents(events, updatedAt),
    actualRows: buildActualDockEvents({
      sailingDay,
      events,
      updatedAt,
      vesselLocations,
      tripIndexes,
    }),
    physicalOnlyTripKeysToPreserve: tripIndexes.physicalOnlyTripKeysToPreserve,
  };
};

/**
 * Builds the trip lookups needed by actual-row assembly.
 *
 * @param activeTrips - Active vessel trips for the reload sailing day
 * @param completedTrips - Completed vessel trips for the reload sailing day
 * @returns Segment, active-vessel, and physical-only trip projections
 */
const indexTripsForReload = (
  activeTrips: ReloadTripForActuals[],
  completedTrips: ReloadTripForActuals[]
): TripIndexes => {
  const tripKeyBySegmentKey = new Map<string, string>();
  const activeTripsByVesselAbbrev = new Map<string, ReloadTripWithTripKey>();
  const physicalOnlyTrips: ReloadTripWithTripKey[] = [];
  const allTrips = [...activeTrips, ...completedTrips];

  for (const trip of allTrips) {
    if (trip.TripKey === undefined) {
      continue;
    }

    tripKeyBySegmentKey.set(trip.ScheduleKey ?? trip.TripKey, trip.TripKey);

    if (trip.ScheduleKey === undefined) {
      physicalOnlyTrips.push({ ...trip, TripKey: trip.TripKey });
    }
  }

  for (const trip of activeTrips) {
    if (trip.TripKey !== undefined) {
      activeTripsByVesselAbbrev.set(trip.VesselAbbrev, {
        ...trip,
        TripKey: trip.TripKey,
      });
    }
  }

  return {
    tripKeyBySegmentKey,
    activeTripsByVesselAbbrev,
    physicalOnlyTrips,
    physicalOnlyTripKeysToPreserve: new Set(
      physicalOnlyTrips.map((trip) => trip.TripKey)
    ),
  };
};

/**
 * Filters WSF schedule segments to direct sailing rows with resolved identities.
 *
 * @param segments - Numeric WSF schedule segments for one sailing day
 * @param vessels - Vessel identities for adapter resolution
 * @param terminals - Terminal identities for adapter resolution
 * @returns Direct physical seed segments ready for boundary projection
 */
const resolveSeedSegments = (
  segments: ComputeDockEventsReloadArgs["scheduleSegments"],
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): RawSeedSegment[] =>
  classifyDirectSegments(
    segments
      .map((segment) => toRawSeedSegment(segment, vessels, terminals))
      .filter((segment): segment is RawSeedSegment => segment !== null)
  ).filter((segment) => segment.TripType === "direct");

/**
 * Resolves one WSF schedule segment to the raw seed shape reload uses.
 *
 * @param segment - WSF schedule segment for one sailing leg
 * @param vessels - Vessel identities for adapter resolution
 * @param terminals - Terminal identities for adapter resolution
 * @returns Seed segment or null when identity/key resolution fails
 */
const toRawSeedSegment = (
  segment: ComputeDockEventsReloadArgs["scheduleSegments"][number],
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): RawSeedSegment | null => {
  const resolvedSegment = resolveScheduleSegment(
    toAdapterScheduleSegment(segment),
    vessels,
    terminals
  );

  if (resolvedSegment === null) {
    return null;
  }

  const key = buildSegmentKey(
    resolvedSegment.vessel.VesselAbbrev,
    resolvedSegment.departingTerminal.TerminalAbbrev,
    resolvedSegment.arrivingTerminal.TerminalAbbrev,
    new Date(segment.DepartingTime)
  );

  return key === undefined
    ? null
    : {
        Key: key,
        VesselAbbrev: resolvedSegment.vessel.VesselAbbrev,
        DepartingTerminalAbbrev:
          resolvedSegment.departingTerminal.TerminalAbbrev,
        ArrivingTerminalAbbrev: resolvedSegment.arrivingTerminal.TerminalAbbrev,
        DepartingTime: segment.DepartingTime,
        ArrivingTime: segment.ArrivingTime,
        SailingDay: segment.SailingDay,
        RouteID: segment.RouteID,
        RouteAbbrev: segment.RouteAbbrev,
      };
};

/**
 * Maps one epoch-ms scheduled segment to the adapter Date shape.
 *
 * @param segment - WSF scheduled segment using epoch-ms for trip times
 * @returns Adapter-shaped segment for resolveScheduleSegment
 */
const toAdapterScheduleSegment = (
  segment: ComputeDockEventsReloadArgs["scheduleSegments"][number]
): RawWsfScheduleSegment =>
  ({
    ...segment,
    DepartingTime: new Date(segment.DepartingTime),
    ArrivingTime:
      segment.ArrivingTime === undefined
        ? undefined
        : new Date(segment.ArrivingTime),
  }) as RawWsfScheduleSegment;

/**
 * Projects seed segments into boundary records and hydrates history actuals.
 *
 * @param args.seedSegments - Direct seed segments for one sailing day
 * @param args.historyRecords - WSF vessel history rows using epoch ms
 * @param args.vessels - Vessel identities for history resolution
 * @param args.terminals - Terminal identities for history resolution
 * @returns Hydrated boundary event records for one sailing day
 */
const hydrateScheduledEvents = ({
  seedSegments,
  historyRecords,
  vessels,
  terminals,
}: {
  seedSegments: RawSeedSegment[];
  historyRecords: ComputeDockEventsReloadArgs["historyRecords"];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}): DockStatusEventRecord[] => {
  const seededEvents = seedSegments.flatMap(buildSeedEventsForSegment);
  const historyActualsByEventKey = mapHistoryActualsToEventKeys({
    seededEvents,
    directSeedSegments: seedSegments,
    historyRecords,
    vessels,
    terminals,
  });

  return seededEvents.map((event) => {
    const historyActualTime = historyActualsByEventKey.get(event.Key);
    const mergedActualTime = mergeActualTime(
      event.EventActualTime,
      historyActualTime,
      event.EventType === "dep-dock" ? "departure-actual" : "arrival-proxy"
    );

    return {
      ...event,
      EventOccurred:
        mergedActualTime === undefined ? event.EventOccurred : true,
      EventActualTime: mergedActualTime,
      EventPredictedTime:
        mergedActualTime === undefined ? event.EventPredictedTime : undefined,
    };
  });
};

/**
 * Builds dep and arv boundary records for one seed segment.
 *
 * @param segment - Direct seed segment
 * @returns Departure followed by arrival boundary record
 */
const buildSeedEventsForSegment = (
  segment: RawSeedSegment
): [DockStatusEventRecord, DockStatusEventRecord] => {
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
 * Nudges scheduled arrival time backward when it equals the dep instant.
 *
 * @param scheduledArrival - Scheduled arrival time in epoch milliseconds
 * @param scheduledDeparture - Scheduled departure time in epoch milliseconds
 * @returns Adjusted arrival time or the original value when distinct
 */
const normalizeScheduledArrivalTime = (
  scheduledArrival: number | undefined,
  scheduledDeparture: number
) =>
  scheduledArrival !== undefined && scheduledArrival === scheduledDeparture
    ? scheduledArrival - IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS
    : scheduledArrival;

/**
 * Resolves the schedule-implied arrival time when the segment lacks one.
 *
 * @param segment - Direct seed segment for one physical leg
 * @returns Scheduled arrival in epoch ms, or undefined when unresolvable
 */
const getOfficialScheduledArrivalTime = (segment: RawSeedSegment) => {
  if (segment.RouteID === 9 && segment.ArrivingTime !== undefined) {
    return segment.ArrivingTime;
  }

  const duration = getOfficialCrossingTimeMinutes({
    routeAbbrev: segment.RouteAbbrev,
    departingTerminalAbbrev: segment.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: segment.ArrivingTerminalAbbrev,
  });

  return duration === undefined
    ? undefined
    : segment.DepartingTime + duration * 60 * 1000;
};

/**
 * Chooses the actual timestamp to keep when history and an existing row differ.
 *
 * @param existingActualTime - Time already on the boundary record
 * @param historyActualTime - Time from WSF history hydration
 * @param source - Whether the history column was departure-actual or arrival-proxy
 * @returns Merged actual ms or undefined when both inputs are undefined
 */
const mergeActualTime = (
  existingActualTime?: number,
  historyActualTime?: number,
  source?: HistoryActualSource
) => {
  if (existingActualTime === undefined) {
    return historyActualTime;
  }

  if (historyActualTime === undefined) {
    return existingActualTime;
  }

  const replacementThreshold =
    source === "arrival-proxy"
      ? ARRIVAL_PROXY_REPLACEMENT_THRESHOLD_MS
      : DEPARTURE_ACTUAL_REPLACEMENT_THRESHOLD_MS;

  return Math.abs(existingActualTime - historyActualTime) >=
    replacementThreshold
    ? historyActualTime
    : existingActualTime;
};

/**
 * Adjusts back-to-back scheduled dock seams that share the same scheduled minute.
 *
 * @param events - Boundary records for one reload batch
 * @returns Copy with dep times nudged where identical seams were detected
 */
const normalizeScheduledDockSeams = (
  events: DockStatusEventRecord[]
): DockStatusEventRecord[] => {
  const adjustedScheduledTimesByKey = new Map<string, number>();
  const eventsByVesselDay = new Map<string, DockStatusEventRecord[]>();

  for (const event of events) {
    const key = `${event.VesselAbbrev}:${event.SailingDay}`;
    eventsByVesselDay.set(key, [...(eventsByVesselDay.get(key) ?? []), event]);
  }

  for (const scopedEvents of eventsByVesselDay.values()) {
    const sortedScopedEvents = [...scopedEvents].sort(
      compareDockEventsByTimeline
    );

    for (let index = 0; index < sortedScopedEvents.length; index++) {
      const event = sortedScopedEvents[index];
      const next = sortedScopedEvents[index + 1];

      if (
        event.EventScheduledTime !== undefined &&
        next !== undefined &&
        event.EventType === "arv-dock" &&
        next.EventType === "dep-dock" &&
        event.TerminalAbbrev === next.TerminalAbbrev &&
        event.EventScheduledTime === next.EventScheduledTime
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

    return adjustedScheduledTime === undefined
      ? event
      : { ...event, EventScheduledTime: adjustedScheduledTime };
  });
};

/**
 * Compares two boundary records for timeline ordering when sorting an array.
 *
 * @param left - First record
 * @param right - Second record
 * @returns Comparator value suitable for Array.sort
 */
const compareDockEventsByTimeline = (
  left: DockStatusEventRecord,
  right: DockStatusEventRecord
) =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  (left.EventType === "dep-dock" ? 0 : 1) -
    (right.EventType === "dep-dock" ? 0 : 1) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

/**
 * Projects hydrated boundary records into Convex scheduled dock rows.
 *
 * @param events - Hydrated boundary records sorted in timeline order
 * @param updatedAt - UpdatedAt stamp for the produced rows
 * @returns Validator-shaped scheduled dock rows
 */
const buildScheduledDockEvents = (
  events: DockStatusEventRecord[],
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
        : (eventByKey.get(buildBoundaryKey(event.SegmentKey, "arv-dock"))
            ?.TerminalAbbrev ?? event.TerminalAbbrev),
    EventType: event.EventType,
    EventScheduledTime: event.EventScheduledTime,
    IsLastArrivalOfSailingDay:
      event.EventType === "arv-dock" && event.Key === lastArrivalKey,
  }));
};

/**
 * Builds actual dock rows from history, physical-only trips, and live pings.
 *
 * @param args - Hydrated events, trip indexes, latest locations, and timestamps
 * @returns Unique actual dock rows for the sailing-day reload
 */
const buildActualDockEvents = ({
  sailingDay,
  events,
  updatedAt,
  vesselLocations,
  tripIndexes,
}: {
  sailingDay: string;
  events: DockStatusEventRecord[];
  updatedAt: number;
  vesselLocations: ConvexVesselLocation[];
  tripIndexes: TripIndexes;
}): ConvexActualDockEvent[] => {
  const rows: ConvexActualDockEvent[] = [
    ...buildHistoryActualRows(events, updatedAt, tripIndexes),
    ...buildPhysicalOnlyTripActualRows(updatedAt, tripIndexes),
  ];
  const sailingDayLocations = vesselLocations.filter((location) =>
    locationMatchesSailingDay(location, sailingDay)
  );
  const representedTripBoundaryKeys = buildTripBoundaryKeySet(rows);
  const eventsByVessel = new Map<string, DockStatusEventRecord[]>();
  for (const event of events) {
    eventsByVessel.set(event.VesselAbbrev, [
      ...(eventsByVessel.get(event.VesselAbbrev) ?? []),
      event,
    ]);
  }

  for (const location of sailingDayLocations) {
    rows.push(
      ...buildScheduleAlignedLocationRows({
        location,
        events: eventsByVessel.get(location.VesselAbbrev) ?? [],
        updatedAt,
        tripIndexes,
        representedTripBoundaryKeys,
      })
    );
  }

  for (const location of sailingDayLocations) {
    rows.push(
      ...buildPhysicalOnlyLocationRows({
        location,
        updatedAt,
        tripIndexes,
        representedTripBoundaryKeys,
      })
    );
  }

  return dedupeActualRowsByEventKey(rows);
};

/**
 * Projects hydrated boundary records with actual evidence into actual rows.
 *
 * @param events - Hydrated boundary records
 * @param updatedAt - UpdatedAt stamp for the produced rows
 * @param tripIndexes - Reload trip indexes for TripKey lookup
 * @returns Validator-shaped actual dock rows for boundaries with actuals
 */
const buildHistoryActualRows = (
  events: DockStatusEventRecord[],
  updatedAt: number,
  tripIndexes: TripIndexes
): ConvexActualDockEvent[] =>
  events.flatMap((event) => {
    const tripKey = tripIndexes.tripKeyBySegmentKey.get(event.SegmentKey);

    if (
      tripKey === undefined ||
      (event.EventOccurred !== true && event.EventActualTime === undefined)
    ) {
      return [];
    }

    return [
      buildActualDockEventFromWrite(
        {
          TripKey: tripKey,
          VesselAbbrev: event.VesselAbbrev,
          SailingDay: event.SailingDay,
          ScheduledDeparture: event.ScheduledDeparture,
          TerminalAbbrev: event.TerminalAbbrev,
          EventType: event.EventType,
          EventOccurred: true,
          EventActualTime: event.EventActualTime,
        },
        updatedAt
      ),
    ];
  });

/**
 * Builds actual rows from physical-only trip fields.
 *
 * @param updatedAt - UpdatedAt stamp for the produced rows
 * @param tripIndexes - Reload trip indexes containing physical-only trips
 * @returns Actual rows from durable trip departure and arrival fields
 */
const buildPhysicalOnlyTripActualRows = (
  updatedAt: number,
  tripIndexes: TripIndexes
): ConvexActualDockEvent[] =>
  tripIndexes.physicalOnlyTrips.flatMap((trip) => [
    ...(trip.LeftDockActual === undefined
      ? []
      : [
          buildActualDockEventFromWrite(
            buildPhysicalOnlyActualWrite(
              trip,
              trip.DepartingTerminalAbbrev,
              "dep-dock",
              trip.LeftDockActual
            ),
            updatedAt
          ),
        ]),
    ...(trip.TripEnd === undefined || trip.ArrivingTerminalAbbrev === undefined
      ? []
      : [
          buildActualDockEventFromWrite(
            buildPhysicalOnlyActualWrite(
              trip,
              trip.ArrivingTerminalAbbrev,
              "arv-dock",
              trip.TripEnd
            ),
            updatedAt
          ),
        ]),
  ]);

/**
 * Builds schedule-aligned actual rows from one live location ping.
 *
 * @param args - Location, same-vessel events, trip indexes, and dedupe set
 * @returns Departure or arrival rows supported by the ping
 */
const buildScheduleAlignedLocationRows = ({
  location,
  events,
  updatedAt,
  tripIndexes,
  representedTripBoundaryKeys,
}: {
  location: ConvexVesselLocation;
  events: DockStatusEventRecord[];
  updatedAt: number;
  tripIndexes: TripIndexes;
  representedTripBoundaryKeys: Set<string>;
}): ConvexActualDockEvent[] => {
  if (events.length === 0 || location.InService !== true) {
    return [];
  }

  const departureEvent = getLocationAnchoredEvent(events, location, "dep-dock");
  const candidates = [
    { event: departureEvent, eventActualTime: location.LeftDock },
    {
      event: findArrivalEventForLocation(events, location, departureEvent),
      eventActualTime: undefined,
    },
  ];
  const rows: ConvexActualDockEvent[] = [];

  for (const { event, eventActualTime } of candidates) {
    const tripKey =
      event === undefined
        ? undefined
        : tripIndexes.tripKeyBySegmentKey.get(event.SegmentKey);

    if (
      event === undefined ||
      tripKey === undefined ||
      event.EventOccurred === true ||
      (event.EventType === "dep-dock" &&
        location.LeftDock === undefined &&
        location.AtDock !== false) ||
      (event.EventType === "arv-dock" && location.AtDock !== true)
    ) {
      continue;
    }

    const row = buildActualDockEventFromWrite(
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
    representedTripBoundaryKeys.add(toTripBoundaryKey(row));
    rows.push(row);
  }

  return rows;
};

/**
 * Builds physical-only actual rows from one live location ping.
 *
 * @param args - Location, active-trip index, updatedAt, and dedupe set
 * @returns Physical-only departure or arrival rows supported by the ping
 */
const buildPhysicalOnlyLocationRows = ({
  location,
  updatedAt,
  tripIndexes,
  representedTripBoundaryKeys,
}: {
  location: ConvexVesselLocation;
  updatedAt: number;
  tripIndexes: TripIndexes;
  representedTripBoundaryKeys: Set<string>;
}): ConvexActualDockEvent[] => {
  const trip = tripIndexes.activeTripsByVesselAbbrev.get(location.VesselAbbrev);
  const rows: ConvexActualDockEvent[] = [];

  if (
    location.InService !== true ||
    trip === undefined ||
    trip.ScheduleKey !== undefined
  ) {
    return [];
  }

  if (location.AtDock === false) {
    pushPhysicalOnlyLocationRow({
      rows,
      trip,
      terminalAbbrev: trip.DepartingTerminalAbbrev,
      eventType: "dep-dock",
      eventActualTime: location.LeftDock ?? location.TimeStamp,
      updatedAt,
      representedTripBoundaryKeys,
    });
  }

  if (location.AtDock === true && trip.ArrivingTerminalAbbrev !== undefined) {
    pushPhysicalOnlyLocationRow({
      rows,
      trip,
      terminalAbbrev: trip.ArrivingTerminalAbbrev,
      eventType: "arv-dock",
      eventActualTime: location.TimeStamp,
      updatedAt,
      representedTripBoundaryKeys,
    });
  }

  return rows;
};

/**
 * Pushes one physical-only row unless that trip boundary is represented.
 *
 * @param args - Row buffer, trip, boundary fields, updatedAt, and dedupe set
 * @returns Void; mutates the provided row buffer and represented set
 */
const pushPhysicalOnlyLocationRow = ({
  rows,
  trip,
  terminalAbbrev,
  eventType,
  eventActualTime,
  updatedAt,
  representedTripBoundaryKeys,
}: {
  rows: ConvexActualDockEvent[];
  trip: ReloadTripWithTripKey;
  terminalAbbrev: string;
  eventType: DockEventType;
  eventActualTime: number;
  updatedAt: number;
  representedTripBoundaryKeys: Set<string>;
}): void => {
  const boundaryKey = `${trip.TripKey}|${eventType}`;

  if (representedTripBoundaryKeys.has(boundaryKey)) {
    return;
  }

  rows.push(
    buildActualDockEventFromWrite(
      buildPhysicalOnlyActualWrite(
        trip,
        terminalAbbrev,
        eventType,
        eventActualTime
      ),
      updatedAt
    )
  );
  representedTripBoundaryKeys.add(boundaryKey);
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

  return [...events]
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
    .sort(
      (left, right) => right.ScheduledDeparture - left.ScheduledDeparture
    )[0];
};

/**
 * Builds a predicate that keeps locations whose sailing day matches the target.
 *
 * @param sailingDay - Target sailing day
 * @returns Predicate over vessel locations using sailing-day calendaring
 */
const locationMatchesSailingDay = (
  location: ConvexVesselLocation,
  sailingDay: string
) =>
  getSailingDay(new Date(location.ScheduledDeparture ?? location.TimeStamp)) ===
  sailingDay;

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

/**
 * Shapes one physical-only actual write from a trip and observed time.
 *
 * @param trip - Physical-only trip with TripKey
 * @param terminalAbbrev - Terminal hosting the boundary
 * @param eventType - Dock boundary discriminator
 * @param eventActualTime - Observed time in epoch milliseconds
 * @returns Persistable actual dock write
 */
const buildPhysicalOnlyActualWrite = (
  trip: ReloadTripWithTripKey,
  terminalAbbrev: string,
  eventType: DockEventType,
  eventActualTime: number
): ConvexActualDockWritePersistable => ({
  TripKey: trip.TripKey,
  VesselAbbrev: trip.VesselAbbrev,
  SailingDay: trip.SailingDay,
  ScheduledDeparture: trip.ScheduledDeparture,
  TerminalAbbrev: terminalAbbrev,
  EventType: eventType,
  EventOccurred: true,
  EventActualTime: eventActualTime,
});

export { computeDockEventsReload };
