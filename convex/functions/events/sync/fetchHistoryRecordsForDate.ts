/**
 * Fetches WSF vessel-history rows for dock-event reloads.
 *
 * The action only requests history for vessels present in the fetched schedule
 * slice, which keeps the reload bounded to the physical day being refreshed.
 */

import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import { fetchVesselHistoriesByVesselAndDates } from "ws-dottie/wsf-vessels/core";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";

/**
 * Fetches vessel-history rows for vessels in a schedule slice.
 *
 * @param scheduleSegments - Schedule segments whose VesselName fields identify vessels
 * @param targetDate - YYYY-MM-DD sailing day passed to the history API
 * @returns Concatenated history rows across requested vessels
 */
const fetchHistoryRecordsForDate = async (
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

export { fetchHistoryRecordsForDate };
