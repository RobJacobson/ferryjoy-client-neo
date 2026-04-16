/**
 * Downloads raw WSF route schedules and normalizes them into raw segment rows.
 */

import type { Route, TerminalCombo } from "ws-dottie/wsf-schedule";
import { fetchRouteSchedule } from "./fetchRouteSchedule";
import type {
  RawWsfRouteScheduleData,
  RawWsfScheduleSegment,
  VesselSailing,
} from "./types";

/**
 * Downloads raw schedule segments for all routes on one sailing day.
 *
 * @param routes - Active WSF routes for the requested day
 * @param tripDate - Sailing day in `YYYY-MM-DD` format
 * @returns Route payloads containing normalized raw schedule segments
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
        .filter((segment): segment is RawWsfScheduleSegment => segment !== null)
    );

    return { route, segments, rawTripCount };
  });

  return await Promise.all(routePromises);
};

/**
 * Converts one WSF route sailing row into the adapter's raw schedule segment.
 *
 * @param sailing - Raw WSF vessel sailing row
 * @param terminalCombo - Terminal pairing metadata for the sailing
 * @param route - Parent WSF route metadata
 * @param tripDate - Sailing day in `YYYY-MM-DD` format
 * @returns Normalized raw schedule segment or `null` when required fields are missing
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
 * Extracts terminal-combo annotation strings for a sailing row.
 *
 * @param sailing - Raw WSF sailing row with annotation indexes
 * @param terminalCombo - Terminal combo containing annotation text
 * @returns Resolved annotation strings
 */
const extractAnnotations = (
  sailing: VesselSailing,
  terminalCombo: TerminalCombo
): string[] => {
  if (!sailing.AnnotationIndexes) {
    return [];
  }

  return sailing.AnnotationIndexes.filter(
    (index) => index < terminalCombo.Annotations.length
  ).map((index) => terminalCombo.Annotations[index]);
};
