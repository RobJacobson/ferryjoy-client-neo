/**
 * WSF schedule adapter for loading one route schedule on a sailing day.
 */

import type { Schedule } from "ws-dottie/wsf-schedule";
import { fetchScheduleByTripDateAndRouteId } from "ws-dottie/wsf-schedule";
import { retryOnce } from "./retryOnce";

/**
 * Fetches detailed WSF schedule data for one route on one sailing day.
 *
 * @param routeId - WSF route identifier
 * @param tripDate - Sailing day in `YYYY-MM-DD` format
 * @returns Full WSF schedule payload for the requested route and day
 */
export const fetchRouteSchedule = async (
  routeId: number,
  tripDate: string
): Promise<Schedule> =>
  await retryOnce(() =>
    fetchScheduleByTripDateAndRouteId({
      params: {
        TripDate: tripDate,
        RouteID: routeId,
      },
    })
  );
