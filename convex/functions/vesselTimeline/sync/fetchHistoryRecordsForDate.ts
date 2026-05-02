/**
 * Fetches external vessel history rows for sync pipeline segments.
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
  // Get the unique vessel names from the schedule segments
  const vesselNames = Array.from(
    new Set(
      scheduleSegments
        .map((segment) => segment.VesselName?.trim())
        .filter((name): name is string => Boolean(name))
    )
  );

  // Fetch the history records for each vessel
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

  // Return the flattened history records
  return historyBatches.flat();
};
