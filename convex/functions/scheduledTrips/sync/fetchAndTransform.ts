/**
 * Shared schedule download and transformation helpers for schedule-backed
 * consumers owned by the ScheduledTrips sync module.
 */

import type { Route } from "ws-dottie/wsf-schedule";
import type { ConvexScheduledTrip } from "../schemas";
import { createScheduledTripFromRawSegment } from "./fetching/mapping";
import type { RawWsfRouteScheduleData } from "../../../shared/fetchWsfScheduleData";
import {
  downloadRawWsfScheduleData,
  fetchActiveRoutes,
} from "../../../shared/fetchWsfScheduleData";
import { runTransformationPipeline } from "./transform";

export type FetchAndTransformScheduledTripsResult = {
  routes: Route[];
  routeData: RawWsfRouteScheduleData[];
  rawTrips: ConvexScheduledTrip[];
  finalTrips: ConvexScheduledTrip[];
  totalIndirect: number;
};

/**
 * Shared schedule fetch + transformation flow used by ScheduledTrips sync and
 * VesselTimeline boundary-event sync.
 *
 * @param targetDate - Service date to fetch in `YYYY-MM-DD` format
 * @returns Raw route payloads plus the mapped and transformed trip rows
 */
export const fetchAndTransformScheduledTrips = async (
  targetDate: string
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
    .map((segment) => createScheduledTripFromRawSegment(segment))
    .filter((trip): trip is ConvexScheduledTrip => trip !== null);

  const finalTrips = runTransformationPipeline(rawTrips);
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
