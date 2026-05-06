/**
 * Converts action-side fetched schedule and history slices into reload payloads.
 *
 * Adapter rows carry Date objects, while Convex validators for internal
 * mutations use epoch milliseconds. Keeping conversion here avoids ad-hoc date
 * handling in the action orchestration.
 */

import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import { dateToEpochMs, optionalDateToEpochMs } from "shared/convertDates";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import type {
  ConvexReloadDockData,
  ConvexReloadDockHistoryRecord,
  ConvexReloadDockScheduleSegment,
} from "./reloadDockDataSchemas";

type BuildConvexReloadDockDataFromFetchedSlicesArgs = {
  sailingDay: string;
  scheduleSegments: RawWsfScheduleSegment[];
  historyRecords: VesselHistory[];
};

/**
 * Builds a Convex-shaped reload payload from fetched WSF slices.
 *
 * @param args.sailingDay - Target sailing day string
 * @param args.scheduleSegments - Date-shaped schedule segments from adapter
 * @param args.historyRecords - Date-shaped WSF vessel history records
 * @returns Numeric reload payload accepted by internal mutations
 */
const buildConvexReloadDockDataFromFetchedSlices = ({
  sailingDay,
  scheduleSegments,
  historyRecords,
}: BuildConvexReloadDockDataFromFetchedSlicesArgs): ConvexReloadDockData => ({
  SailingDay: sailingDay,
  ScheduleSegments: scheduleSegments.map(toConvexReloadDockScheduleSegment),
  HistoryRecords: historyRecords.map(toConvexReloadDockHistoryRecord),
});

/**
 * Converts one schedule segment to numeric reload shape.
 *
 * @param segment - Adapter schedule segment
 * @returns Convex reload schedule segment
 */
const toConvexReloadDockScheduleSegment = (
  segment: RawWsfScheduleSegment
): ConvexReloadDockScheduleSegment => ({
  VesselName: segment.VesselName,
  DepartingTerminalID: segment.DepartingTerminalID,
  ArrivingTerminalID: segment.ArrivingTerminalID,
  DepartingTerminalName: segment.DepartingTerminalName,
  ArrivingTerminalName: segment.ArrivingTerminalName,
  DepartingTime: dateToEpochMs(segment.DepartingTime),
  ArrivingTime: optionalDateToEpochMs(segment.ArrivingTime),
  SailingNotes: segment.SailingNotes,
  Annotations: segment.Annotations,
  RouteID: segment.RouteID,
  RouteAbbrev: segment.RouteAbbrev,
  SailingDay: segment.SailingDay,
});

/**
 * Converts one history record to numeric reload shape.
 *
 * @param record - WSF vessel history record
 * @returns Convex reload history record
 */
const toConvexReloadDockHistoryRecord = (
  record: VesselHistory
): ConvexReloadDockHistoryRecord => ({
  VesselId: record.VesselId,
  Vessel: record.Vessel ?? undefined,
  Departing: record.Departing ?? undefined,
  Arriving: record.Arriving ?? undefined,
  ScheduledDepart: optionalDateToEpochMs(record.ScheduledDepart),
  ActualDepart: optionalDateToEpochMs(record.ActualDepart),
  EstArrival: optionalDateToEpochMs(record.EstArrival),
});

export { buildConvexReloadDockDataFromFetchedSlices };
