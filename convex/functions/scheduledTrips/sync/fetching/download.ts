import type { Route } from "ws-dottie/wsf-schedule";
import type { ConvexScheduledTrip } from "../../schemas";
import type { VesselSailing } from "../types";
import { createScheduledTrip } from "./mapping";
import { fetchRouteSchedule } from "./wsfApi";

/**
 * High-level logic for downloading and initial mapping of all scheduled trips for a set of routes.
 *
 * @param routes - Array of routes to download data for
 * @param tripDate - Trip date in YYYY-MM-DD format
 * @returns Array of route data objects containing processed trips and metadata
 */
export const downloadAllRouteData = async (
  routes: Route[],
  tripDate: string
): Promise<
  {
    route: Route;
    trips: ConvexScheduledTrip[];
    rawTripCount: number;
  }[]
> => {
  const routePromises = routes.map(async (route) => {
    const schedule = await fetchRouteSchedule(route.RouteID, tripDate);

    const rawTripCount = schedule.TerminalCombos.flatMap(
      (terminalCombo) => (terminalCombo.Times as VesselSailing[]).length
    ).reduce((sum, count) => sum + count, 0);

    const routeTrips = schedule.TerminalCombos.flatMap((terminalCombo) =>
      (terminalCombo.Times as VesselSailing[])
        .map((vesselSailing) =>
          createScheduledTrip(vesselSailing, terminalCombo, route, tripDate)
        )
        .filter((trip): trip is ConvexScheduledTrip => trip !== null)
    );

    return { route, trips: routeTrips, rawTripCount };
  });

  return await Promise.all(routePromises);
};
