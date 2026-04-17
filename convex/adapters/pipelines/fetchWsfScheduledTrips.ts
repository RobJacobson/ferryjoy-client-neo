/**
 * Shared WSF schedule ingress pipeline for schedule-backed backend consumers.
 */

import { runScheduleTransformPipeline } from "domain/scheduledTrips";
import type { ConvexScheduledTrip } from "functions/scheduledTrips/schemas";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { Route } from "ws-dottie/wsf-schedule";
import {
  downloadRawWsfScheduleData,
  fetchActiveRoutes,
} from "../fetch/fetchWsfScheduledTripsData";
import type { RawWsfRouteScheduleData } from "../fetch/fetchWsfScheduledTripsTypes";
import { createScheduledTripFromRawSegment } from "./createWsfScheduledTripFromRawSegment";

type FetchAndTransformScheduledTripsResult = {
  routes: Route[];
  routeData: RawWsfRouteScheduleData[];
  rawTrips: ConvexScheduledTrip[];
  finalTrips: ConvexScheduledTrip[];
  totalIndirect: number;
};

/**
 * Fetches WSF schedule data, maps it into backend rows, and runs the domain
 * schedule transform pipeline.
 *
 * @param targetDate - Sailing day in `YYYY-MM-DD` format
 * @param vessels - Backend vessel identity rows
 * @param terminals - Backend terminal identity rows
 * @returns Raw route payloads plus mapped and transformed scheduled trips
 * @throws Error when a resolved segment cannot produce a stable schedule key
 */
export const fetchAndTransformScheduledTrips = async (
  targetDate: string,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): Promise<FetchAndTransformScheduledTripsResult> => {
  const routes = await fetchActiveRoutes(targetDate);

  if (routes.length === 0) {
    return {
      routes,
      routeData: [],
      rawTrips: [],
      finalTrips: [],
      totalIndirect: 0,
    };
  }

  const routeData = await downloadRawWsfScheduleData(routes, targetDate);
  const rawTrips = routeData
    .flatMap((data) => data.segments)
    .map((segment) =>
      createScheduledTripFromRawSegment(segment, vessels, terminals)
    )
    .filter((trip): trip is ConvexScheduledTrip => trip !== null);
  const finalTrips = runScheduleTransformPipeline(rawTrips);
  const totalIndirect = finalTrips.filter(
    (trip) => trip.TripType === "indirect"
  ).length;

  return {
    routes,
    routeData,
    rawTrips,
    finalTrips,
    totalIndirect,
  };
};
