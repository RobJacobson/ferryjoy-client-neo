import type { Route, Schedule, TerminalCombo } from "ws-dottie/wsf-schedule";
import {
  fetchRoutesByTripDate,
  fetchScheduleByTripDateAndRouteId,
} from "ws-dottie/wsf-schedule";
import type { VesselSailing } from "../functions/scheduledTrips/sync/types";

/**
 * Neutral raw schedule segment derived directly from the WSF schedule API.
 * This shape is intentionally lighter than ConvexScheduledTrip so multiple
 * downstream consumers can derive their own read models from it.
 */
export type RawWsfScheduleSegment = {
  VesselName: string;
  DepartingTerminalName: string;
  ArrivingTerminalName: string;
  DepartingTime: Date;
  ArrivingTime: Date | null;
  SailingNotes: string;
  Annotations: string[];
  RouteID: number;
  RouteAbbrev: string;
  SailingDay: string;
};

export type RawWsfRouteScheduleData = {
  route: Route;
  segments: RawWsfScheduleSegment[];
  rawTripCount: number;
};

/**
 * Configuration constants for WSF schedule operations.
 */
export const CONFIG = {
  /** Delay in milliseconds before retrying failed external API calls */
  RETRY_DELAY_MS: 15000,
} as const;

/**
 * Fetches all active routes for a specific trip date from the WSF API.
 */
export const fetchActiveRoutes = async (tripDate: string): Promise<Route[]> =>
  await retryOnce(() =>
    fetchRoutesByTripDate({ params: { TripDate: tripDate } })
  );

/**
 * Fetches detailed schedule data for a specific route and trip date.
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
 * Downloads raw schedule segments for all routes on the requested sailing day.
 */
export const downloadRawWsfScheduleData = async (
  routes: Route[],
  tripDate: string
): Promise<RawWsfRouteScheduleData[]> => {
  const routePromises = routes.map(async (route) => {
    const schedule = await fetchRouteSchedule(route.RouteID, tripDate);

    const rawTripCount = schedule.TerminalCombos.flatMap(
      (terminalCombo) => (terminalCombo.Times as VesselSailing[]).length
    ).reduce((sum, count) => sum + count, 0);

    const segments = schedule.TerminalCombos.flatMap((terminalCombo) =>
      (terminalCombo.Times as VesselSailing[])
        .map((vesselSailing) =>
          createRawWsfScheduleSegment(
            vesselSailing,
            terminalCombo,
            route,
            tripDate
          )
        )
        .filter(
          (segment): segment is RawWsfScheduleSegment => segment !== null
        )
    );

    return { route, segments, rawTripCount };
  });

  return await Promise.all(routePromises);
};

/**
 * Creates a neutral raw schedule segment from the WSF API response shape.
 */
const createRawWsfScheduleSegment = (
  sailing: VesselSailing,
  terminalCombo: TerminalCombo,
  route: Route,
  tripDate: string
): RawWsfScheduleSegment | null => {
  const departingTerminalName = terminalCombo.DepartingTerminalName;
  const arrivingTerminalName = terminalCombo.ArrivingTerminalName;

  if (
    !sailing.VesselName ||
    !departingTerminalName ||
    !arrivingTerminalName ||
    !sailing.DepartingTime
  ) {
    return null;
  }

  return {
    VesselName: sailing.VesselName,
    DepartingTerminalName: departingTerminalName,
    ArrivingTerminalName: arrivingTerminalName,
    DepartingTime: sailing.DepartingTime,
    ArrivingTime: sailing.ArrivingTime,
    SailingNotes: terminalCombo.SailingNotes,
    Annotations: extractAnnotations(sailing, terminalCombo),
    RouteID: route.RouteID,
    RouteAbbrev: route.RouteAbbrev || "",
    SailingDay: tripDate,
  };
};

/**
 * Extracts annotation strings from a terminal combo using the sailing's
 * annotation indexes.
 */
const extractAnnotations = (
  sailing: VesselSailing,
  terminalCombo: TerminalCombo
): string[] => {
  if (!sailing.AnnotationIndexes) return [];

  return sailing.AnnotationIndexes.filter(
    (index) => index < terminalCombo.Annotations.length
  ).map((index) => terminalCombo.Annotations[index]);
};

/**
 * Simple retry utility for external API calls with one fixed-delay retry.
 */
const retryOnce = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    console.warn("API call failed, retrying once:", error);
    await new Promise((resolve) => setTimeout(resolve, CONFIG.RETRY_DELAY_MS));
    return await fn();
  }
};
