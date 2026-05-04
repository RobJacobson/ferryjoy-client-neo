/**
 * Fetches external vessel history rows for dock-event reload segments.
 */

import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import { fetchVesselHistoriesByVesselAndDates } from "ws-dottie/wsf-vessels/core";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";

/**
 * Fetches external vessel history rows for vessels on a schedule slice.
 *
 * Only vessels appearing on provided segments are queried to avoid broad history scans.
 * Parallel per-vessel fetches keep action latency bounded while preserving day-only filtering.
 *
 * @param scheduleSegments - Scheduled segments whose VesselName fields identify vessels
 * @param targetDate - Sailing day YYYY-MM-DD passed through to the history API
 * @returns Concatenated VesselHistory rows across all requested vessel names
 */
export const fetchHistoryRecordsForDate = async (
  scheduleSegments: RawWsfScheduleSegment[],
  targetDate: string
): Promise<VesselHistory[]> => {
  const vesselNames = Array.from(
    new Set(
      scheduleSegments
        .map((segment) => segment.VesselName?.trim())
        .filter((name): name is string => Boolean(name))
    )
  );

  const historyBatches = await Promise.all(
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

  return historyBatches.flat();
};
