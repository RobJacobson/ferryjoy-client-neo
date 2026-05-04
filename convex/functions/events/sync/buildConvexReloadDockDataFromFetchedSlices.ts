/**
 * Builds the Convex reload payload from fetched schedule and history slices.
 *
 * Action-side mappers normalize Date-shaped adapter rows into the epoch-ms
 * Convex payload that the internal reload mutation accepts. Centralizing the
 * Date-to-epoch conversion here keeps action callers free of ad-hoc getTime
 * sprinkling and matches the pattern used by mapWsfVesselLocations and
 * createScheduledTripFromRawSegment.
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
 * Assembles a ConvexReloadDockData payload from action-side fetch results.
 *
 * Converts Date instants on schedule segments and vessel history rows into
 * epoch milliseconds via shared convertDates helpers so the Convex mutation
 * boundary stays numeric (matching ConvexVesselLocation and ConvexScheduledTrip
 * conventions). Empty optional Date fields collapse to undefined rather than
 * null to keep validator unions tight.
 *
 * @param args.sailingDay - Calendar sailing day string for the reload window
 * @param args.scheduleSegments - Direct WSF schedule segments fetched for the day
 * @param args.historyRecords - WSF vessel-history rows fetched for the day
 * @returns Convex-shaped payload accepted by replaceDockEventsForSailingDay
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
 * Maps one raw WSF schedule segment into the epoch-ms wire shape.
 *
 * @param segment - Date-shaped fetch-layer schedule segment
 * @returns Convex-shaped schedule segment using epoch milliseconds
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
 * Maps one raw WSF vessel-history row into the epoch-ms wire shape.
 *
 * Strips fields the reload pipeline does not consume (VesselId is retained for
 * traceability, but feed-only labels like Date are dropped) so the payload
 * stays as small as the validator allows. Optional Date and string fields
 * become undefined when absent so Convex unions match the schema exactly.
 *
 * @param record - Date-shaped fetch-layer vessel history row
 * @returns Convex-shaped vessel history row using epoch milliseconds
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
