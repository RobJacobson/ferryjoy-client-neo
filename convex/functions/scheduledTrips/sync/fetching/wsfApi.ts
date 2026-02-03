import type { Route, Schedule } from "ws-dottie/wsf-schedule";
import {
  fetchRoutesByTripDate,
  fetchScheduleByTripDateAndRouteId,
} from "ws-dottie/wsf-schedule";

/**
 * Configuration constants for scheduled trips operations.
 */
export const CONFIG = {
  /** Delay in milliseconds before retrying failed external API calls */
  RETRY_DELAY_MS: 15000,
} as const;

/**
 * Fetches all active routes for a specific trip date from WSF API.
 * Routes determine which ferry services are operating on a given day.
 *
 * @param tripDate - Trip date in YYYY-MM-DD format
 * @returns Array of active routes for the specified date
 */
export const fetchActiveRoutes = async (tripDate: string): Promise<Route[]> =>
  await retryOnce(() =>
    fetchRoutesByTripDate({ params: { TripDate: tripDate } })
  );

/**
 * Fetches detailed schedule data for a specific route and trip date from WSF API.
 * Retrieves all terminal combinations, times, and annotations for the given route.
 * This is the core data source for scheduled trip information.
 *
 * @param routeId - WSF route identifier (e.g., 1 for Seattle-Bainbridge)
 * @param tripDate - Trip date in YYYY-MM-DD format (WSF operational day)
 * @returns Complete schedule data including terminal combinations and vessel times
 * @throws Error if WSF API call fails after retry attempts
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

/**
 * Simple retry utility for external API calls with exponential backoff.
 * Implements a single retry with fixed delay to handle transient network issues.
 * Used for all WSF API calls to improve reliability.
 *
 * @param fn - Async function to retry on failure
 * @returns Result of the function call (either first attempt or retry)
 * @throws Last error encountered if both attempts fail
 */
const retryOnce = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    console.warn("API call failed, retrying once:", error);
    // Fixed delay retry - simple and predictable for external API calls
    await new Promise((resolve) => setTimeout(resolve, CONFIG.RETRY_DELAY_MS));
    return await fn();
  }
};
