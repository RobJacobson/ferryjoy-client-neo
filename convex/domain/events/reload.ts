/**
 * Scheduled and actual dock-event reload assembly.
 *
 * Static sync uses this module to rebuild one sailing-day slice from fetched
 * schedule and history payloads. It mirrors the old vessel timeline reseed flow
 * while keeping reload-specific transforms out of scheduled continuity and
 * realtime actual-write normalization.
 */

import {
  resolveScheduleSegment,
  resolveVesselHistory,
  type TerminalIdentity,
  tryResolveVessel,
  type VesselIdentity,
} from "adapters";
import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type {
  ConvexReloadDockHistoryRecord,
  ConvexReloadDockScheduleSegment,
} from "functions/events/sync/reloadDockDataSchemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { buildBoundaryKey, buildSegmentKey } from "shared/keys";
import { getSailingDay } from "shared/time";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import {
  classifyDirectSegments,
  getOfficialCrossingTimeMinutes,
} from "../scheduledTrips";
import {
  buildActualDockEventFromWrite,
  type ConvexActualDockWritePersistable,
} from "./actual";

const IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS = 5 * 60 * 1000;
const DEPARTURE_ACTUAL_REPLACEMENT_THRESHOLD_MS = 3 * 60 * 1000;
const ARRIVAL_PROXY_REPLACEMENT_THRESHOLD_MS = 2 * 60 * 1000;
const MOVING_SPEED_THRESHOLD = 0.2;
const DOCKED_SPEED_THRESHOLD = 0.2;

type DockEventType = ConvexScheduledDockEvent["EventType"];

type DockBoundaryEventRecord = {
  SegmentKey: string;
  Key: string;
  VesselAbbrev: string;
  SailingDay: string;
  ScheduledDeparture: number;
  TerminalAbbrev: string;
  EventType: DockEventType;
  EventScheduledTime?: number;
  EventPredictedTime?: number;
  EventOccurred?: true;
  EventActualTime?: number;
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

type TripContextForActualRow = {
  TripKey: string;
};

type TripRowForActualContext = {
  TripKey?: string;
  ScheduleKey?: string;
};

type ActiveTripForPhysicalActualReconcile = {
  TripKey?: string;
  ScheduleKey?: string;
  VesselAbbrev: string;
  SailingDay?: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev?: string;
  ScheduledDeparture?: number;
  LeftDockActual?: number;
  TripEnd?: number;
};

type BuildReloadDockEventRowsArgs = {
  sailingDay: string;
  scheduleSegments: ConvexReloadDockScheduleSegment[];
  historyRecords: ConvexReloadDockHistoryRecord[];
  updatedAt: number;
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
  tripBySegmentKey: Map<string, TripContextForActualRow>;
  activeTripsByVesselAbbrev: Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >;
  physicalOnlyTrips: ActiveTripForPhysicalActualReconcile[];
  vesselLocations: ConvexVesselLocation[];
};

type BuildReloadDockEventRowsResult = {
  scheduledRows: ConvexScheduledDockEvent[];
  actualRows: ConvexActualDockEvent[];
  scheduledCount: number;
  actualCount: number;
};

type HistoryActualSource = "departure-actual" | "arrival-proxy";

type NormalizedHistoryRecord = {
  tripKey: string;
  actualDeparture?: number;
  arrivalProxy?: number;
};

type ReloadActualDockWrite = {
  SegmentKey: string;
  TripKey?: string;
  VesselAbbrev: string;
  SailingDay: string;
  ScheduledDeparture: number;
  TerminalAbbrev: string;
  EventType: DockEventType;
  EventOccurred: true;
  EventActualTime?: number;
};

/**
 * Builds scheduled dock rows for one static sailing-day reload.
 *
 * This is the scheduled-only half of the old reseed flow. Actual reload uses
 * buildReloadDockEventRows so history, physical rows, and live locations stay
 * assembled from the same seeded boundary records.
 *
 * @param args.scheduleSegments - Numeric schedule reload segments
 * @param args.updatedAt - Timestamp to stamp onto produced rows
 * @param args.vessels - Vessel identities for WSF segment resolution
 * @param args.terminals - Terminal identities for WSF segment resolution
 * @returns Scheduled rows plus the count represented by the normalized slice
 */
const buildReloadScheduledDockRows = ({
  scheduleSegments,
  updatedAt,
  vessels,
  terminals,
}: {
  scheduleSegments: ConvexReloadDockScheduleSegment[];
  updatedAt: number;
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}): {
  scheduledRows: ConvexScheduledDockEvent[];
  scheduledCount: number;
} => {
  const normalizedEvents = buildScheduledDockEventRecords(
    scheduleSegments,
    vessels,
    terminals
  ).sort(sortDockBoundaryEventRecords);

  return {
    scheduledRows: buildScheduledDockEvents(normalizedEvents, updatedAt),
    scheduledCount: normalizedEvents.length,
  };
};

/**
 * Builds scheduled and actual dock rows for one static sailing-day reload.
 *
 * Schedule records are seeded first, history actuals hydrate those boundary
 * records, then actual rows are assembled from hydrated records, physical-only
 * trip evidence, and live-location reconciliation.
 *
 * @param args - Schedule, history, identity, trip, and location reload context
 * @returns Scheduled and actual rows plus operator-facing counts
 */
const buildReloadDockEventRows = ({
  sailingDay,
  scheduleSegments,
  historyRecords,
  updatedAt,
  vessels,
  terminals,
  tripBySegmentKey,
  activeTripsByVesselAbbrev,
  physicalOnlyTrips,
  vesselLocations,
}: BuildReloadDockEventRowsArgs): BuildReloadDockEventRowsResult => {
  const seededEvents = buildScheduledDockEventRecords(
    scheduleSegments,
    vessels,
    terminals
  );
  const hydratedEvents = hydrateDockEventRecordsWithHistory({
    seededEvents,
    scheduleSegments,
    historyRecords,
    vessels,
    terminals,
  });
  const normalizedEvents = normalizeScheduledDockSeams(hydratedEvents).sort(
    sortDockBoundaryEventRecords
  );
  const scheduledRows = buildScheduledDockEvents(normalizedEvents, updatedAt);
  const baseActualRows = dedupeActualRowsByEventKey([
    ...buildActualDockEvents(normalizedEvents, updatedAt, tripBySegmentKey),
    ...buildPhysicalOnlyActualRowsFromTrips(physicalOnlyTrips, updatedAt),
  ]);
  const liveLocationRows = buildLiveLocationActualRows({
    sailingDay,
    events: normalizedEvents,
    actualRows: baseActualRows,
    updatedAt,
    vesselLocations,
    tripBySegmentKey,
    activeTripsByVesselAbbrev,
  });
  const actualRows = dedupeActualRowsByEventKey([
    ...baseActualRows,
    ...liveLocationRows,
  ]);

  return {
    scheduledRows,
    actualRows,
    scheduledCount: normalizedEvents.length,
    actualCount: actualRows.length,
  };
};

/**
 * Builds schedule-derived boundary records from raw reload segments.
 *
 * @param segments - Numeric schedule reload segments from the sync mutation
 * @param vessels - Vessel identities for WSF segment resolution
 * @param terminals - Terminal identities for WSF segment resolution
 * @returns Direct physical sailing boundary records
 */
const buildScheduledDockEventRecords = (
  segments: ConvexReloadDockScheduleSegment[],
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): DockBoundaryEventRecord[] =>
  normalizeScheduledDockSeams(
    getDirectRawSeedSegments(segments, vessels, terminals)
      .flatMap((segment) =>
        buildSeedEventsForSegment({
          SailingDay: segment.SailingDay,
          VesselAbbrev: segment.VesselAbbrev,
          ScheduledDeparture: segment.DepartingTime,
          DepartingTerminalAbbrev: segment.DepartingTerminalAbbrev,
          ArrivingTerminalAbbrev: segment.ArrivingTerminalAbbrev,
          ScheduledArrival: normalizeScheduledArrivalTime(
            segment.ArrivingTime ?? getOfficialScheduledArrivalTime(segment),
            segment.DepartingTime
          ),
        })
      )
      .sort(sortDockBoundaryEventRecords)
  );

/**
 * Hydrates seeded boundary records with WSF history actuals.
 *
 * @param args - Seeded records plus schedule, history, and identity context
 * @returns Boundary records with actual fields merged from history
 */
const hydrateDockEventRecordsWithHistory = ({
  seededEvents,
  scheduleSegments,
  historyRecords,
  vessels,
  terminals,
}: {
  seededEvents: DockBoundaryEventRecord[];
  scheduleSegments: ConvexReloadDockScheduleSegment[];
  historyRecords: ConvexReloadDockHistoryRecord[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}): DockBoundaryEventRecord[] => {
  const historyActualsByEventKey = getHistoryActualsByEventKey({
    seededEvents,
    scheduleSegments,
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
        mergedActualTime !== undefined ? true : event.EventOccurred,
      EventActualTime: mergedActualTime,
      EventPredictedTime:
        mergedActualTime === undefined ? event.EventPredictedTime : undefined,
    };
  });
};

/**
 * Indexes physical TripKey by schedule-backed or physical segment key.
 *
 * @param trips - Active and completed trip rows for the reload sailing day
 * @returns Map from segment key to physical trip context
 */
const indexTripsBySegmentKey = (
  trips: TripRowForActualContext[]
): Map<string, TripContextForActualRow> => {
  const map = new Map<string, TripContextForActualRow>();

  for (const trip of trips) {
    if (!trip.TripKey) {
      continue;
    }

    map.set(trip.ScheduleKey ?? trip.TripKey, { TripKey: trip.TripKey });
  }

  return map;
};

/**
 * Indexes active trips by vessel abbreviation for live physical patches.
 *
 * @param trips - Active trips in the reload scope
 * @returns Map from vessel abbreviation to the trip carrying TripKey
 */
const indexActiveTripsByVesselAbbrev = (
  trips: ActiveTripForPhysicalActualReconcile[]
): Map<string, ActiveTripForPhysicalActualReconcile & { TripKey: string }> => {
  const map = new Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >();

  for (const trip of trips) {
    if (trip.TripKey !== undefined) {
      map.set(trip.VesselAbbrev, { ...trip, TripKey: trip.TripKey });
    }
  }

  return map;
};

const buildSeedEventsForSegment = (segment: {
  SailingDay: string;
  VesselAbbrev: string;
  ScheduledDeparture: number;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  ScheduledArrival?: number;
}): DockBoundaryEventRecord[] => {
  const SegmentKey = buildSegmentKey(
    segment.VesselAbbrev,
    segment.DepartingTerminalAbbrev,
    segment.ArrivingTerminalAbbrev,
    new Date(segment.ScheduledDeparture)
  );

  if (!SegmentKey) {
    return [];
  }

  return [
    {
      SegmentKey,
      Key: buildBoundaryKey(SegmentKey, "dep-dock"),
      VesselAbbrev: segment.VesselAbbrev,
      SailingDay: segment.SailingDay,
      ScheduledDeparture: segment.ScheduledDeparture,
      TerminalAbbrev: segment.DepartingTerminalAbbrev,
      EventType: "dep-dock",
      EventScheduledTime: segment.ScheduledDeparture,
    },
    {
      SegmentKey,
      Key: buildBoundaryKey(SegmentKey, "arv-dock"),
      VesselAbbrev: segment.VesselAbbrev,
      SailingDay: segment.SailingDay,
      ScheduledDeparture: segment.ScheduledDeparture,
      TerminalAbbrev: segment.ArrivingTerminalAbbrev,
      EventType: "arv-dock",
      EventScheduledTime: segment.ScheduledArrival,
    },
  ];
};

const getDirectRawSeedSegments = (
  segments: ConvexReloadDockScheduleSegment[],
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
) =>
  classifyDirectSegments(
    segments
      .map((segment) => toRawSeedSegment(segment, vessels, terminals))
      .filter((segment): segment is RawSeedSegment => segment !== null)
  ).filter((segment) => segment.TripType === "direct");

const toRawSeedSegment = (
  segment: ConvexReloadDockScheduleSegment,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): RawSeedSegment | null => {
  const resolvedSegment = resolveScheduleSegment(
    toAdapterScheduleSegment(segment),
    vessels,
    terminals
  );

  if (!resolvedSegment) {
    return null;
  }

  const key = buildSegmentKey(
    resolvedSegment.vessel.VesselAbbrev,
    resolvedSegment.departingTerminal.TerminalAbbrev,
    resolvedSegment.arrivingTerminal.TerminalAbbrev,
    new Date(segment.DepartingTime)
  );

  if (!key) {
    return null;
  }

  return {
    Key: key,
    VesselAbbrev: resolvedSegment.vessel.VesselAbbrev,
    DepartingTerminalAbbrev: resolvedSegment.departingTerminal.TerminalAbbrev,
    ArrivingTerminalAbbrev: resolvedSegment.arrivingTerminal.TerminalAbbrev,
    DepartingTime: segment.DepartingTime,
    ArrivingTime: segment.ArrivingTime,
    SailingDay: segment.SailingDay,
    RouteID: segment.RouteID,
    RouteAbbrev: segment.RouteAbbrev,
  };
};

const buildScheduledDockEvents = (
  events: DockBoundaryEventRecord[],
  updatedAt: number
): ConvexScheduledDockEvent[] => {
  const eventByKey = new Map(events.map((event) => [event.Key, event]));
  const lastArrivalKey = getLastArrivalKey(events);

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

const buildActualDockEvents = (
  events: DockBoundaryEventRecord[],
  updatedAt: number,
  tripBySegmentKey: Map<string, TripContextForActualRow>
): ConvexActualDockEvent[] =>
  events
    .filter(
      (event) =>
        event.EventOccurred === true || event.EventActualTime !== undefined
    )
    .flatMap((event) => {
      const trip = tripBySegmentKey.get(event.SegmentKey);

      if (!trip?.TripKey) {
        return [];
      }

      return [
        buildActualDockEventFromWrite(
          {
            TripKey: trip.TripKey,
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

const buildPhysicalOnlyActualRowsFromTrips = (
  trips: ActiveTripForPhysicalActualReconcile[],
  updatedAt: number
): ConvexActualDockEvent[] =>
  trips
    .filter(
      (trip) => trip.TripKey !== undefined && trip.ScheduleKey === undefined
    )
    .flatMap((trip) => {
      const rows: ConvexActualDockEvent[] = [];

      if (trip.TripKey !== undefined && trip.LeftDockActual !== undefined) {
        rows.push(
          buildActualDockEventFromWrite(
            {
              TripKey: trip.TripKey,
              VesselAbbrev: trip.VesselAbbrev,
              SailingDay: trip.SailingDay,
              ScheduledDeparture: trip.ScheduledDeparture,
              TerminalAbbrev: trip.DepartingTerminalAbbrev,
              EventType: "dep-dock",
              EventOccurred: true,
              EventActualTime: trip.LeftDockActual,
            },
            updatedAt
          )
        );
      }

      if (
        trip.TripKey !== undefined &&
        trip.TripEnd !== undefined &&
        trip.ArrivingTerminalAbbrev !== undefined
      ) {
        rows.push(
          buildActualDockEventFromWrite(
            {
              TripKey: trip.TripKey,
              VesselAbbrev: trip.VesselAbbrev,
              SailingDay: trip.SailingDay,
              ScheduledDeparture: trip.ScheduledDeparture,
              TerminalAbbrev: trip.ArrivingTerminalAbbrev,
              EventType: "arv-dock",
              EventOccurred: true,
              EventActualTime: trip.TripEnd,
            },
            updatedAt
          )
        );
      }

      return rows;
    });

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
  events: DockBoundaryEventRecord[];
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

const buildActualDockWritesFromLocation = (
  events: DockBoundaryEventRecord[],
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

const buildActualWriteFromLocation = (
  location: ConvexVesselLocation,
  event: DockBoundaryEventRecord | undefined,
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

const getHistoryActualsByEventKey = ({
  seededEvents,
  scheduleSegments,
  historyRecords,
  vessels,
  terminals,
}: {
  seededEvents: DockBoundaryEventRecord[];
  scheduleSegments: ConvexReloadDockScheduleSegment[];
  historyRecords: ConvexReloadDockHistoryRecord[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}) => {
  const directSegmentsByTripKey = new Map(
    getDirectRawSeedSegments(scheduleSegments, vessels, terminals).map(
      (segment) => [segment.Key, segment]
    )
  );
  const resolveSegmentFromSeededSchedule =
    createSeededScheduleSegmentResolver(seededEvents);

  return historyRecords.reduce((actualsByEventKey, record) => {
    const actualDeparture = record.ActualDepart;
    const arrivalProxy = record.EstArrival;
    const vessel = tryResolveVessel(
      record.Vessel ? String(record.Vessel) : "",
      vessels
    );
    const strictRecord = normalizeHistoryRecordStrict(
      record,
      vessels,
      terminals
    );
    let tripKey: string | undefined;

    if (strictRecord && directSegmentsByTripKey.has(strictRecord.tripKey)) {
      tripKey = strictRecord.tripKey;
    }

    if (tripKey === undefined) {
      const scheduledDepart = record.ScheduledDepart;
      if (
        scheduledDepart !== undefined &&
        vessel !== null &&
        (actualDeparture !== undefined || arrivalProxy !== undefined)
      ) {
        const fallbackKey = resolveSegmentFromSeededSchedule(
          vessel.VesselAbbrev,
          scheduledDepart
        );

        if (
          fallbackKey !== undefined &&
          directSegmentsByTripKey.has(fallbackKey)
        ) {
          tripKey = fallbackKey;
        }
      }
    }

    if (tripKey === undefined) {
      return actualsByEventKey;
    }

    if (actualDeparture !== undefined) {
      actualsByEventKey.set(
        buildBoundaryKey(tripKey, "dep-dock"),
        actualDeparture
      );
    }

    if (arrivalProxy !== undefined) {
      actualsByEventKey.set(
        buildBoundaryKey(tripKey, "arv-dock"),
        arrivalProxy
      );
    }

    return actualsByEventKey;
  }, new Map<string, number>());
};

const normalizeHistoryRecordStrict = (
  record: ConvexReloadDockHistoryRecord,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): NormalizedHistoryRecord | null => {
  const scheduledDepart = record.ScheduledDepart;
  const actualDeparture = record.ActualDepart;
  const arrivalProxy = record.EstArrival;
  const resolvedHistory = resolveVesselHistory(
    toAdapterHistoryRecord(record),
    vessels,
    terminals
  );

  if (
    scheduledDepart === undefined ||
    (actualDeparture === undefined && arrivalProxy === undefined) ||
    resolvedHistory === null
  ) {
    return null;
  }

  const tripKey = buildSegmentKey(
    resolvedHistory.vessel.VesselAbbrev,
    resolvedHistory.departingTerminal.TerminalAbbrev,
    resolvedHistory.arrivingTerminal.TerminalAbbrev,
    new Date(scheduledDepart)
  );

  if (!tripKey) {
    return null;
  }

  return {
    tripKey,
    actualDeparture,
    arrivalProxy,
  };
};

const normalizeScheduledDockSeams = (
  events: DockBoundaryEventRecord[]
): DockBoundaryEventRecord[] => {
  const adjustedScheduledTimesByKey = new Map<string, number>();
  const eventsByVesselDay = groupBy(
    events,
    (event) => `${event.VesselAbbrev}:${event.SailingDay}`
  );

  for (const scopedEvents of eventsByVesselDay.values()) {
    const sortedScopedEvents = [...scopedEvents].sort(
      sortDockBoundaryEventRecords
    );

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
      ? { ...event, EventScheduledTime: adjustedScheduledTime }
      : event;
  });
};

const createSeededScheduleSegmentResolver = (
  seededEvents: ReadonlyArray<DockBoundaryEventRecord>
) => {
  const byVessel = groupBy(
    seededEvents.filter((event) => event.EventType === "dep-dock"),
    (row) => row.VesselAbbrev
  );

  return (vesselAbbrev: string, scheduledDepart: number) =>
    byVessel
      .get(vesselAbbrev)
      ?.find((row) => row.ScheduledDeparture === scheduledDepart)?.SegmentKey;
};

const getLocationAnchoredEvent = (
  events: DockBoundaryEventRecord[],
  location: ConvexVesselLocation,
  eventType: DockEventType
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
  events: DockBoundaryEventRecord[],
  location: ConvexVesselLocation,
  departureEvent: DockBoundaryEventRecord | undefined
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

const locationMatchesSailingDay =
  (sailingDay: string) => (location: ConvexVesselLocation) =>
    getSailingDay(
      new Date(location.ScheduledDeparture ?? location.TimeStamp)
    ) === sailingDay;

const strongDeparture = (location: ConvexVesselLocation) =>
  location.AtDock === false && location.Speed >= MOVING_SPEED_THRESHOLD;

const strongArrival = (location: ConvexVesselLocation) =>
  location.AtDock === true && location.Speed < DOCKED_SPEED_THRESHOLD;

const arrivalEligibilityTime = (event: DockBoundaryEventRecord) =>
  Math.min(
    event.ScheduledDeparture,
    event.EventPredictedTime ?? Number.POSITIVE_INFINITY,
    event.EventScheduledTime ?? Number.POSITIVE_INFINITY
  );

const normalizeScheduledArrivalTime = (
  scheduledArrival: number | undefined,
  scheduledDeparture: number
) =>
  scheduledArrival !== undefined && scheduledArrival === scheduledDeparture
    ? scheduledArrival - IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS
    : scheduledArrival;

const getOfficialScheduledArrivalTime = (segment: RawSeedSegment) => {
  if (segment.RouteID === 9 && segment.ArrivingTime) {
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

const sortDockBoundaryEventRecords = (
  left: DockBoundaryEventRecord,
  right: DockBoundaryEventRecord
) =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  getEventTypeOrder(left.EventType) - getEventTypeOrder(right.EventType) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

const getEventTypeOrder = (eventType: DockEventType) =>
  eventType === "dep-dock" ? 0 : 1;

const isIdenticalScheduledDockSeam = (
  current: DockBoundaryEventRecord,
  next: DockBoundaryEventRecord | undefined
) =>
  next !== undefined &&
  current.EventType === "arv-dock" &&
  next.EventType === "dep-dock" &&
  current.TerminalAbbrev === next.TerminalAbbrev &&
  next.EventScheduledTime !== undefined &&
  current.EventScheduledTime === next.EventScheduledTime;

const getNextTerminalAbbrev = (
  event: DockBoundaryEventRecord,
  eventByKey: Map<string, DockBoundaryEventRecord>
) =>
  eventByKey.get(buildBoundaryKey(event.SegmentKey, "arv-dock"))
    ?.TerminalAbbrev ?? event.TerminalAbbrev;

const getLastArrivalKey = (events: DockBoundaryEventRecord[]) =>
  [...events].reverse().find((event) => event.EventType === "arv-dock")?.Key ??
  null;

const dedupeActualRowsByEventKey = (
  rows: ConvexActualDockEvent[]
): ConvexActualDockEvent[] => [
  ...new Map(rows.map((row) => [row.EventKey, row])).values(),
];

const groupBy = <TValue, TKey>(
  values: TValue[],
  getKey: (value: TValue) => TKey
): Map<TKey, TValue[]> => {
  const groups = new Map<TKey, TValue[]>();

  for (const value of values) {
    const key = getKey(value);
    const group = groups.get(key);

    if (group) {
      group.push(value);
      continue;
    }

    groups.set(key, [value]);
  }

  return groups;
};

const toAdapterScheduleSegment = (
  segment: ConvexReloadDockScheduleSegment
): RawWsfScheduleSegment =>
  ({
    ...segment,
    DepartingTime: new Date(segment.DepartingTime),
    ArrivingTime:
      segment.ArrivingTime !== undefined
        ? new Date(segment.ArrivingTime)
        : undefined,
  }) as RawWsfScheduleSegment;

const toAdapterHistoryRecord = (
  record: ConvexReloadDockHistoryRecord
): VesselHistory =>
  ({
    ...record,
    ScheduledDepart:
      record.ScheduledDepart !== undefined
        ? new Date(record.ScheduledDepart)
        : undefined,
    ActualDepart:
      record.ActualDepart !== undefined
        ? new Date(record.ActualDepart)
        : undefined,
    EstArrival:
      record.EstArrival !== undefined ? new Date(record.EstArrival) : undefined,
  }) as VesselHistory;

export type {
  ActiveTripForPhysicalActualReconcile,
  DockBoundaryEventRecord,
  TripContextForActualRow,
};
export {
  buildReloadDockEventRows,
  buildReloadScheduledDockRows,
  buildScheduledDockEventRecords,
  hydrateDockEventRecordsWithHistory,
  indexActiveTripsByVesselAbbrev,
  indexTripsBySegmentKey,
};
