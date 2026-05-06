/**
 * Minimal actual event domain primitives used by vessel orchestration.
 *
 * Realtime trip updates emit sparse actual dock writes before persistence. This
 * module normalizes only that write shape into eventsActual rows and leaves
 * reload reconciliation to a later sync stage.
 */

import {
  resolveTerminalByAbbrev,
  resolveTerminalByName,
  type TerminalIdentity,
  tryResolveVessel,
  type VesselIdentity,
} from "adapters";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { buildBoundaryKey, buildSegmentKey } from "shared/keys";
import { buildPhysicalActualEventKey } from "shared/physicalTripIdentity";
import { getSailingDay } from "shared/time";
import {
  buildScheduledDockEventRecords,
  type DockBoundaryEventRecord,
  type EventReloadScheduleSegment,
} from "./scheduled";

type ActualDockWriteAnchor =
  | { EventActualTime: number; ScheduledDeparture?: number }
  | { EventActualTime?: number; ScheduledDeparture: number };

type ConvexActualDockWritePersistable = {
  TripKey: string;
  VesselAbbrev: string;
  SailingDay?: string;
  TerminalAbbrev: string;
  SegmentKey?: string;
  EventType: ConvexActualDockEvent["EventType"];
  EventOccurred: true;
  EventKey?: string;
} & ActualDockWriteAnchor;

type EventReloadHistoryRecord = {
  VesselId: number;
  Vessel?: string;
  Departing?: string;
  Arriving?: string;
  ScheduledDepart?: number;
  ActualDepart?: number;
  EstArrival?: number;
};

type TripContextForActualRow = {
  TripKey: string;
};

type TripRowForActualContext = {
  TripKey?: string;
  ScheduleKey?: string;
  SailingDay?: string;
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

type HydrateActualTransitionsFromReloadInputsArgs = {
  scheduleSegments: EventReloadScheduleSegment[];
  historyRecords: EventReloadHistoryRecord[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
};

type BuildActualDockRowsForSailingDayReloadArgs = {
  sailingDay: string;
  events: DockBoundaryEventRecord[];
  updatedAt: number;
  tripBySegmentKey: Map<string, TripContextForActualRow>;
  activeTripsByVesselAbbrev: Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >;
  physicalOnlyTrips: ActiveTripForPhysicalActualReconcile[];
  vesselLocations: ConvexVesselLocation[];
};

/**
 * Builds one persisted actual dock event from a sparse write.
 *
 * EventKey defaults from TripKey and EventType when omitted. SailingDay derives
 * from EventActualTime first, then ScheduledDeparture, and ScheduledDeparture
 * falls back to EventActualTime so physical-only writes remain persistable.
 *
 * @param write - Persistable sparse actual dock write
 * @param updatedAt - Timestamp to stamp onto the normalized row
 * @returns Validator-shaped eventsActual row ready for sparse upsert
 */
const buildActualDockEventFromWrite = (
  write: ConvexActualDockWritePersistable,
  updatedAt: number
): ConvexActualDockEvent => {
  const anchorMs = getActualDockWriteAnchorMs(write);
  const eventKey =
    write.EventKey ??
    buildPhysicalActualEventKey(write.TripKey, write.EventType);
  const sailingDay = write.SailingDay ?? getSailingDay(new Date(anchorMs));
  const scheduledDeparture = write.ScheduledDeparture ?? anchorMs;

  return {
    EventKey: eventKey,
    TripKey: write.TripKey,
    EventType: write.EventType,
    VesselAbbrev: write.VesselAbbrev,
    SailingDay: sailingDay,
    UpdatedAt: updatedAt,
    ScheduledDeparture: scheduledDeparture,
    TerminalAbbrev: write.TerminalAbbrev,
    EventOccurred: true,
    EventActualTime: write.EventActualTime,
  };
};

/**
 * Builds hydrated schedule boundary records for static actual reloads.
 *
 * Schedule seeds provide canonical boundary keys; WSF history contributes
 * measured departure actuals and estimated arrival proxies where it resolves to
 * those same direct segment keys.
 *
 * @param args - Schedule, history, vessel, and terminal reload context
 * @returns Boundary records with actual occurrence fields merged from history
 */
const hydrateActualTransitionsFromReloadInputs = ({
  scheduleSegments,
  historyRecords,
  vessels,
  terminals,
}: HydrateActualTransitionsFromReloadInputsArgs): DockBoundaryEventRecord[] => {
  const seededEvents = buildScheduledDockEventRecords(
    scheduleSegments,
    vessels,
    terminals
  );
  const historyActualsByEventKey = getHistoryActualsByEventKey(
    historyRecords,
    vessels,
    terminals
  );

  return seededEvents.map((event) => {
    const actualTime = historyActualsByEventKey.get(event.Key);

    return actualTime === undefined
      ? event
      : {
          ...event,
          EventOccurred: true,
          EventActualTime: actualTime,
          EventPredictedTime: undefined,
        };
  });
};

/**
 * Builds actual rows for one sailing-day reload pass.
 *
 * The result includes schedule-backed history observations, physical-only trip
 * observations, and simple live-location patches where current samples carry
 * the same physical schedule keys.
 *
 * @param args - Reload context and trip indexes for one sailing day
 * @returns Actual rows plus count to report to operators
 */
const buildActualDockRowsForSailingDayReload = ({
  sailingDay,
  events,
  updatedAt,
  tripBySegmentKey,
  activeTripsByVesselAbbrev,
  physicalOnlyTrips,
  vesselLocations,
}: BuildActualDockRowsForSailingDayReloadArgs): {
  actualRows: ConvexActualDockEvent[];
  actualCount: number;
} => {
  const baseActualRows = dedupeActualRowsByEventKey([
    ...buildActualDockEvents(events, updatedAt, tripBySegmentKey),
    ...buildPhysicalOnlyActualRowsFromTrips(physicalOnlyTrips, updatedAt),
    ...buildLiveLocationActualRows({
      sailingDay,
      updatedAt,
      vesselLocations,
      tripBySegmentKey,
      activeTripsByVesselAbbrev,
    }),
  ]);

  return {
    actualRows: baseActualRows,
    actualCount: baseActualRows.length,
  };
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

/**
 * Resolves the timestamp anchor from a persistable actual dock write.
 *
 * @param write - Persistable sparse actual dock write
 * @returns EventActualTime when present, otherwise ScheduledDeparture
 */
const getActualDockWriteAnchorMs = (
  write: ConvexActualDockWritePersistable
): number => {
  if (write.EventActualTime !== undefined) {
    return write.EventActualTime;
  }

  if (write.ScheduledDeparture !== undefined) {
    return write.ScheduledDeparture;
  }

  throw new Error(
    "Persistable actual dock write requires an anchor timestamp."
  );
};

/**
 * Builds actual rows from hydrated schedule boundary records.
 *
 * @param events - Boundary records with occurrence evidence
 * @param updatedAt - Timestamp applied to produced rows
 * @param tripBySegmentKey - Segment key to physical trip context
 * @returns Actual rows whose SegmentKey resolves to TripKey
 */
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

/**
 * Synthesizes actual rows from scheduleless trips carrying physical evidence.
 *
 * @param trips - Active or completed physical-only trip rows
 * @param updatedAt - Timestamp applied to produced rows
 * @returns Departure and arrival actual rows for available observations
 */
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

/**
 * Builds simple live-location actual patches for reload rows.
 *
 * @param args - Sailing day, live locations, and trip indexes
 * @returns Actual rows inferred directly from current location evidence
 */
const buildLiveLocationActualRows = ({
  sailingDay,
  updatedAt,
  vesselLocations,
  tripBySegmentKey,
  activeTripsByVesselAbbrev,
}: Pick<
  BuildActualDockRowsForSailingDayReloadArgs,
  | "sailingDay"
  | "updatedAt"
  | "vesselLocations"
  | "tripBySegmentKey"
  | "activeTripsByVesselAbbrev"
>): ConvexActualDockEvent[] =>
  vesselLocations
    .filter(
      (location) =>
        getSailingDay(
          new Date(location.ScheduledDeparture ?? location.TimeStamp)
        ) === sailingDay
    )
    .flatMap((location) => {
      const trip =
        location.ScheduleKey !== undefined
          ? tripBySegmentKey.get(location.ScheduleKey)
          : activeTripsByVesselAbbrev.get(location.VesselAbbrev);

      if (!trip?.TripKey) {
        return [];
      }

      const rows: ConvexActualDockEvent[] = [];

      if (location.LeftDock !== undefined) {
        rows.push(
          buildActualDockEventFromWrite(
            {
              TripKey: trip.TripKey,
              VesselAbbrev: location.VesselAbbrev,
              SailingDay: sailingDay,
              ScheduledDeparture: location.ScheduledDeparture,
              TerminalAbbrev: location.DepartingTerminalAbbrev,
              EventType: "dep-dock",
              EventOccurred: true,
              EventActualTime: location.LeftDock,
            },
            updatedAt
          )
        );
      }

      if (location.AtDock && location.ArrivingTerminalAbbrev !== undefined) {
        rows.push(
          buildActualDockEventFromWrite(
            {
              TripKey: trip.TripKey,
              VesselAbbrev: location.VesselAbbrev,
              SailingDay: sailingDay,
              ScheduledDeparture: location.ScheduledDeparture,
              TerminalAbbrev: location.ArrivingTerminalAbbrev,
              EventType: "arv-dock",
              EventOccurred: true,
              EventActualTime: location.TimeStamp,
            },
            updatedAt
          )
        );
      }

      return rows;
    });

/**
 * Dedupe rows by physical EventKey while keeping the last value.
 *
 * @param rows - Actual rows that may repeat physical keys
 * @returns One row per EventKey
 */
const dedupeActualRowsByEventKey = (
  rows: ConvexActualDockEvent[]
): ConvexActualDockEvent[] => [
  ...new Map(rows.map((row) => [row.EventKey, row])).values(),
];

/**
 * Maps history records to canonical dock boundary actual times.
 *
 * @param historyRecords - WSF vessel history rows in numeric reload shape
 * @param vessels - Vessel identities
 * @param terminals - Terminal identities
 * @returns Boundary key to actual/proxy timestamp map
 */
const getHistoryActualsByEventKey = (
  historyRecords: EventReloadHistoryRecord[],
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): Map<string, number> => {
  const actualsByEventKey = new Map<string, number>();

  for (const record of historyRecords) {
    const scheduledDepart = record.ScheduledDepart;
    if (
      scheduledDepart === undefined ||
      (record.ActualDepart === undefined && record.EstArrival === undefined)
    ) {
      continue;
    }

    const resolvedHistory = resolveReloadHistoryRecord(
      record,
      vessels,
      terminals
    );

    if (resolvedHistory === null) {
      continue;
    }

    const tripKey = buildSegmentKey(
      resolvedHistory.vessel.VesselAbbrev,
      resolvedHistory.departingTerminal.TerminalAbbrev,
      resolvedHistory.arrivingTerminal.TerminalAbbrev,
      new Date(scheduledDepart)
    );

    if (!tripKey) {
      continue;
    }

    if (record.ActualDepart !== undefined) {
      actualsByEventKey.set(
        buildBoundaryKey(tripKey, "dep-dock"),
        record.ActualDepart
      );
    }

    if (record.EstArrival !== undefined) {
      actualsByEventKey.set(
        buildBoundaryKey(tripKey, "arv-dock"),
        record.EstArrival
      );
    }
  }

  return actualsByEventKey;
};

const HISTORY_TERMINAL_ABBREV_ALIASES: Record<string, string> = {
  Colman: "P52",
  Keystone: "COU",
  Vashon: "VAI",
};

/**
 * Resolves one numeric history row against identity tables.
 *
 * @param record - WSF history reload record
 * @param vessels - Vessel identity rows
 * @param terminals - Terminal identity rows
 * @returns Resolved identity tuple or null
 */
const resolveReloadHistoryRecord = (
  record: EventReloadHistoryRecord,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): {
  vessel: VesselIdentity;
  departingTerminal: TerminalIdentity;
  arrivingTerminal: TerminalIdentity;
} | null => {
  const vessel = tryResolveVessel(
    record.Vessel ? String(record.Vessel) : "",
    vessels
  );
  const departingTerminal = resolveHistoryTerminal(
    record.Departing ?? "",
    terminals
  );
  const arrivingTerminal = resolveHistoryTerminal(
    record.Arriving ?? "",
    terminals
  );

  return vessel && departingTerminal && arrivingTerminal
    ? { vessel, departingTerminal, arrivingTerminal }
    : null;
};

/**
 * Resolves WSF history terminal labels with a small alias map.
 *
 * @param terminalName - Raw history terminal name
 * @param terminals - Terminal identity rows
 * @returns Matching terminal identity or null
 */
const resolveHistoryTerminal = (
  terminalName: string,
  terminals: ReadonlyArray<TerminalIdentity>
): TerminalIdentity | null => {
  const normalized = terminalName.trim();

  if (!normalized) {
    return null;
  }

  const exactMatch = resolveTerminalByName(normalized, terminals);

  if (exactMatch) {
    return exactMatch;
  }

  const aliasAbbrev = HISTORY_TERMINAL_ABBREV_ALIASES[normalized];

  return aliasAbbrev ? resolveTerminalByAbbrev(aliasAbbrev, terminals) : null;
};

export type {
  ActiveTripForPhysicalActualReconcile,
  ConvexActualDockWritePersistable,
  EventReloadHistoryRecord,
  TripContextForActualRow,
};
export {
  buildActualDockEventFromWrite,
  buildActualDockRowsForSailingDayReload,
  hydrateActualTransitionsFromReloadInputs,
  indexActiveTripsByVesselAbbrev,
  indexTripsBySegmentKey,
};
