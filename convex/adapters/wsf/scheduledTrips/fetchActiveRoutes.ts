/**
 * WSF schedule adapter for loading active routes on a sailing day.
 */

import type { Route } from "ws-dottie/wsf-schedule";
import { fetchRoutesByTripDate } from "ws-dottie/wsf-schedule";
import { retryOnce } from "./retryOnce";

/**
 * Fetches all active WSF routes for a specific trip date.
 *
 * @param tripDate - Sailing day in `YYYY-MM-DD` format
 * @returns Active WSF routes for that day
 */
export const fetchActiveRoutes = async (tripDate: string): Promise<Route[]> =>
  await retryOnce(() =>
    fetchRoutesByTripDate({ params: { TripDate: tripDate } })
  );
