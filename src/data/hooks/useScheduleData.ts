/**
 * Client schedule data hook.
 *
 * Fetches WSF schedule data via `ws-dottie`, merges across routes for a given
 * trip date, then applies the same classification + chain logic as the server
 * scheduledTrips sync pipeline.
 *
 * Key behaviors:
 * - Fail the whole query if any route fetch fails.
 * - Return both direct and indirect trips (flagged by `TripType`).
 * - Use official crossing times for synthetic arrival estimates.
 * - Include schedule cache flush date in the query key (Option A).
 */

import { useQuery } from "@tanstack/react-query";
import { Platform } from "react-native";
import type { Schedule } from "ws-dottie/wsf-schedule";
import {
  fetchScheduleByTripDateAndRouteId,
  useCacheFlushDateSchedule,
} from "ws-dottie/wsf-schedule";
import { wsfRoutesData } from "@/data/routes";
import { calculateTripEstimates } from "@/domain/schedule/calculateTripEstimates";
import { classifyTripsByType } from "@/domain/schedule/classifyTripsByType";
import { createScheduledTripMs } from "@/domain/schedule/dataTransformation";
import { toDomainScheduledTrip } from "@/domain/schedule/types";
import type { ScheduledTrip, ScheduledTripMs } from "@/domain/schedule/types";

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Fetch and process schedule data for a trip date and route IDs.
 *
 * @param tripDate - Trip date in YYYY-MM-DD format (WSF operational day)
 * @param routeIds - Array of WSF RouteIDs
 * @returns React Query result containing merged scheduled trips
 */
export const useScheduleData = (tripDate: string, routeIds: number[]) => {
  const fetchMode = Platform.OS === "web" ? "jsonp" : "native";

  const normalizedRouteIds = normalizeRouteIds(routeIds);

  const flushDateQuery = useCacheFlushDateSchedule({
    fetchMode,
    validate: false,
  });
  const flushDate = flushDateQuery.data ?? "";

  return useQuery({
    queryKey: ["scheduleData", tripDate, normalizedRouteIds, flushDate],
    enabled: tripDate.length > 0 && normalizedRouteIds.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<ScheduledTrip[]> => {
      const schedulesByRoute = await Promise.all(
        normalizedRouteIds.map(async (routeId) => ({
          routeId,
          schedule: await fetchScheduleByTripDateAndRouteId({
            params: { TripDate: tripDate, RouteID: routeId },
            fetchMode,
            validate: false,
          }),
        }))
      );

      const rawTrips = schedulesByRoute.flatMap(({ routeId, schedule }) =>
        createTripsForRoute(routeId, tripDate, schedule)
      );

      const classified = classifyTripsByType(rawTrips);
      const enhanced = calculateTripEstimates(classified);

      return enhanced
        .slice()
        .sort((a, b) => a.DepartingTime - b.DepartingTime)
        .map(toDomainScheduledTrip);
    },
  });
};

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Normalize a routeId list for stable query keying.
 *
 * @param routeIds - Route IDs (possibly unsorted/duplicated)
 * @returns Unique, ascending-sorted route IDs
 */
const normalizeRouteIds = (routeIds: number[]): number[] => {
  const unique = Array.from(new Set(routeIds));
  unique.sort((a, b) => a - b);
  return unique;
};

/**
 * Convert a route schedule payload into raw `ScheduledTripMs` records.
 *
 * @param routeId - WSF RouteID
 * @param tripDate - Trip date string (YYYY-MM-DD)
 * @param schedule - WSF schedule response
 * @returns Raw scheduled trips (ms timestamps)
 */
const createTripsForRoute = (
  routeId: number,
  tripDate: string,
  schedule: Schedule
): ScheduledTripMs[] => {
  const routeAbbrev = wsfRoutesData.routes[String(routeId)]?.routeAbbrev || "";

  return schedule.TerminalCombos.flatMap((terminalCombo) =>
    terminalCombo.Times.map((sailing) =>
      createScheduledTripMs(sailing, terminalCombo, { routeId, routeAbbrev }, tripDate)
    ).filter((trip): trip is ScheduledTripMs => trip !== null)
  );
};

