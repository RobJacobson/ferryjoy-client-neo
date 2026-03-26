import type { Route } from "ws-dottie/wsf-schedule";
import type { ConvexScheduledTrip } from "../../functions/scheduledTrips/schemas";
import { createScheduledTripFromRawSegment } from "../../functions/scheduledTrips/sync/fetching/mapping";
import type { RawWsfRouteScheduleData } from "../../shared/fetchWsfScheduleData";
import {
  downloadRawWsfScheduleData,
  fetchActiveRoutes,
} from "../../shared/fetchWsfScheduleData";
import { runTransformationPipeline } from "./transform";

export type FetchAndTransformScheduledTripsResult = {
  routes: Route[];
  routeData: RawWsfRouteScheduleData[];
  rawTrips: ConvexScheduledTrip[];
  finalTrips: ConvexScheduledTrip[];
  totalIndirect: number;
};

/**
 * Shared schedule fetch + transformation flow used by both scheduledTrips and
 * VesselTimeline boundary-event sync. It fetches raw WSF schedule data once, maps it into the
 * scheduled-trip shape, and computes the richer scheduled-trip transform.
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
