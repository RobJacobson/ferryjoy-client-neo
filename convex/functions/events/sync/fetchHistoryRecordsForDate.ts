/**
 * Fetches external vessel history rows for dock-event reload segments.
 */

import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import { fetchVesselHistoriesByVesselAndDates } from "ws-dottie/wsf-vessels/core";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";

/**
 * Fetches external vessel history rows for vessels on a schedule slice.
 *
 * Derives unique `VesselName` values from segments, then parallel-fetches each
 * vessel for `targetDate` only and flattens results for hydration.
 *
 * @param scheduleSegments - Scheduled segments used to derive vessel names
 * @param targetDate - Sailing day in YYYY-MM-DD format
 * @returns Flattened vessel history rows for the requested day
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
