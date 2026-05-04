/**
 * Restores Date-shaped adapter rows from the Convex reload payload.
 *
 * Mutation-edge mappers turn the validated epoch-ms wire shape back into the
 * RawWsfScheduleSegment and VesselHistory types that downstream domain stages
 * already accept. Keeping this conversion in one helper avoids scattering
 * epochMsToDate calls across the mutation handler and matches the inverse of
 * buildConvexReloadDockDataFromFetchedSlices.
 */

import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import { epochMsToDate, optionalEpochMsToDate } from "shared/convertDates";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import type {
  ConvexReloadDockData,
  ConvexReloadDockHistoryRecord,
  ConvexReloadDockScheduleSegment,
} from "./reloadDockDataSchemas";

type ConvexReloadDockRawFetchShapes = {
  scheduleSegments: RawWsfScheduleSegment[];
  historyRecords: VesselHistory[];
};

/**
 * Restores Date-shaped fetch payloads from one ConvexReloadDockData payload.
 *
 * Domain stages such as buildScheduledDockEventRecords and
 * hydrateActualDockEvents still accept Date-shaped rows; converting at the
 * mutation edge isolates the wire format from internal logic so the domain
 * does not need a parallel epoch-ms code path.
 *
 * @param data - Validated reload payload received by the mutation
 * @returns Schedule segments and history records with Date instants
 */
const mapConvexReloadDockDataToRawFetchShapes = (
  data: ConvexReloadDockData
): ConvexReloadDockRawFetchShapes => ({
  scheduleSegments: data.ScheduleSegments.map(toRawWsfScheduleSegment),
  historyRecords: data.HistoryRecords.map(toVesselHistory),
});

/**
 * Maps one Convex schedule segment back into a RawWsfScheduleSegment.
 *
 * @param segment - Convex-shaped schedule segment with epoch milliseconds
 * @returns Date-shaped fetch-layer schedule segment
 */
const toRawWsfScheduleSegment = (
  segment: ConvexReloadDockScheduleSegment
): RawWsfScheduleSegment => ({
  VesselName: segment.VesselName,
  DepartingTerminalID: segment.DepartingTerminalID,
  ArrivingTerminalID: segment.ArrivingTerminalID,
  DepartingTerminalName: segment.DepartingTerminalName,
  ArrivingTerminalName: segment.ArrivingTerminalName,
  DepartingTime: epochMsToDate(segment.DepartingTime),
  ArrivingTime: optionalEpochMsToDate(segment.ArrivingTime) ?? null,
  SailingNotes: segment.SailingNotes,
  Annotations: segment.Annotations,
  RouteID: segment.RouteID,
  RouteAbbrev: segment.RouteAbbrev,
  SailingDay: segment.SailingDay,
});

/**
 * Maps one Convex history row back into a VesselHistory.
 *
 * Restores nullable string fields and Date instants so the row matches the
 * shape resolveVesselHistory and hydrateActualDockEvents already consume.
 * Fields not present in the wire validator (for example the Date column on
 * VesselHistory) default to null so resolution-stage falsy checks behave the
 * same as for unfetched rows.
 *
 * @param record - Convex-shaped vessel history row with epoch milliseconds
 * @returns Date-shaped fetch-layer vessel history row
 */
const toVesselHistory = (
  record: ConvexReloadDockHistoryRecord
): VesselHistory => ({
  VesselId: record.VesselId,
  Vessel: record.Vessel ?? null,
  Departing: record.Departing ?? null,
  Arriving: record.Arriving ?? null,
  ScheduledDepart: optionalEpochMsToDate(record.ScheduledDepart) ?? null,
  ActualDepart: optionalEpochMsToDate(record.ActualDepart) ?? null,
  EstArrival: optionalEpochMsToDate(record.EstArrival) ?? null,
  Date: null,
});

export type { ConvexReloadDockRawFetchShapes };
export { mapConvexReloadDockDataToRawFetchShapes };
