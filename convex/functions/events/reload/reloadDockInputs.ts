/**
 * Fetches WSF vessel history and maps adapter schedule segments to epoch-ms
 * fields for dock-event reload hydrate.
 */

import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import type {
  WsfScheduledSegment,
  WsfVesselHistory,
} from "domain/events/reload/types";
import { dateToEpochMs, optionalDateToEpochMs } from "shared/convertDates";
import { fetchVesselHistoriesByVesselAndDates } from "ws-dottie/wsf-vessels/core";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";

/**
 * Loads WSF vessel history rows for distinct vessels named on schedule segments.
 *
 * @param segments - Raw schedule segments carrying VesselName values
 * @param targetDate - YYYY-MM-DD sailing day passed to the history API
 * @returns Concatenated history rows across requested vessels
 */
const collectHistoryRowsForScheduleVessels = async (
  segments: RawWsfScheduleSegment[],
  targetDate: string
): Promise<VesselHistory[]> => {
  const vesselNames = Array.from(
    new Set(
      segments
        .map((segment) => segment.VesselName?.trim())
        .filter((name): name is string => Boolean(name))
    )
  );

  const batches = await Promise.all(
    vesselNames.map((vesselName) =>
      fetchVesselHistoriesByVesselAndDates({
        params: {
          VesselName: vesselName,
          DateStart: targetDate,
          DateEnd: targetDate,
        },
      })
    )
  );

  return batches.flat();
};

/**
 * Maps one WSF schedule segment with Date fields into epoch-ms trip times for
 * reload hydrate input.
 *
 * @param segment - Adapter schedule segment with Date values
 * @returns WsfScheduledSegment with epoch-ms trip times for Convex reload
 */
const wsfScheduleSegmentToConvexScheduledSegment = (
  segment: RawWsfScheduleSegment
): WsfScheduledSegment => ({
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
 * Maps one WSF vessel history row from the API into epoch-ms timestamp fields.
 *
 * @param record - Vessel history row from the WSF API with Date-valued times
 * @returns WsfVesselHistory with epoch-ms times for Convex reload
 */
const wsfVesselHistoryToConvexVesselHistory = (
  record: VesselHistory
): WsfVesselHistory => ({
  VesselId: record.VesselId,
  Vessel: record.Vessel ?? undefined,
  Departing: record.Departing ?? undefined,
  Arriving: record.Arriving ?? undefined,
  ScheduledDepart: optionalDateToEpochMs(record.ScheduledDepart),
  ActualDepart: optionalDateToEpochMs(record.ActualDepart),
  EstArrival: optionalDateToEpochMs(record.EstArrival),
});

/**
 * Fetches vessel history for schedule-named vessels and maps raw segments plus
 * history into epoch-ms shapes for hydrate.
 *
 * @param segments - Raw schedule segments for the sailing day
 * @param targetDate - Sailing day YYYY-MM-DD string
 * @returns Scheduled segments and history rows using epoch-ms for times
 */
const fetchReloadWsfInputs = async (
  segments: RawWsfScheduleSegment[],
  targetDate: string
): Promise<{
  scheduledSegments: WsfScheduledSegment[];
  historyRecords: WsfVesselHistory[];
}> => {
  const historyRows = await collectHistoryRowsForScheduleVessels(
    segments,
    targetDate
  );

  return {
    scheduledSegments: segments.map(wsfScheduleSegmentToConvexScheduledSegment),
    historyRecords: historyRows.map(wsfVesselHistoryToConvexVesselHistory),
  };
};

export { fetchReloadWsfInputs };
