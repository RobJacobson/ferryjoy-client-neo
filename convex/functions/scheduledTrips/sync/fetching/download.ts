import { downloadRawWsfScheduleData } from "shared/fetchWsfScheduleData";
import type { Route } from "ws-dottie/wsf-schedule";
import type { VesselIdentity } from "../../../../shared/vessels";
import type { TerminalIdentity } from "../../../terminals/resolver";
import type { ConvexScheduledTrip } from "../../schemas";
import { createScheduledTripFromRawSegment } from "./mapping";

/**
 * High-level logic for downloading and initial mapping of all scheduled trips for a set of routes.
 *
 * @param routes - Array of routes to download data for
 * @param tripDate - Trip date in YYYY-MM-DD format
 * @returns Array of route data objects containing processed trips and metadata
 */
export const downloadAllRouteData = async (
  routes: Route[],
  tripDate: string,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): Promise<
  {
    route: Route;
    trips: ConvexScheduledTrip[];
    rawTripCount: number;
  }[]
> => {
  const routeData = await downloadRawWsfScheduleData(routes, tripDate);

  return routeData.map(({ route, segments, rawTripCount }) => ({
    route,
    trips: segments
      .map((segment) =>
        createScheduledTripFromRawSegment(segment, vessels, terminals)
      )
      .filter((trip): trip is ConvexScheduledTrip => trip !== null),
    rawTripCount,
  }));
};
