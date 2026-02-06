/**
 * Hook that fetches and resolves all data needed to render the ScheduledTrips list.
 * Returns status (loading/empty/ready), journeys, and page resolution per journey.
 */

import { api } from "convex/_generated/api";
import { toDomainVesselTrip } from "convex/functions/vesselTrips/schemas";
import { useQuery } from "convex/react";
import { useConvexVesselLocations } from "@/data/contexts/convex/ConvexVesselLocationsContext";
import { useConvexVesselTrips } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { getSailingDay } from "@/shared/utils/getSailingDay";
import { useDelayedVesselTrips } from "../VesselTrips/useDelayedVesselTrips";
import type { ScheduledTripJourney } from "./types";
import { buildAllPageMaps } from "./utils/buildPageDataMaps";
import { toSegment } from "./utils/conversion";
import type { ScheduledTripCardResolution } from "./utils/resolveScheduledTripsPageResolution";
import { resolveScheduledTripsPageResolution } from "./utils/resolveScheduledTripsPageResolution";

type UseScheduledTripsPageDataParams = {
  terminalAbbrev: string;
  destinationAbbrev?: string;
};

type UseScheduledTripsPageDataResult = {
  status: "loading" | "empty" | "ready";
  journeys: ScheduledTripJourney[] | undefined;
  pageResolutionByTripId: Map<string, ScheduledTripCardResolution>;
};

/**
 * Fetches scheduled trips, completed/active/hold data, and resolves one resolution
 * per journey card (one active per vessel). Use for the ScheduledTrips list page.
 *
 * @param params.terminalAbbrev - Departure terminal to load schedule for
 * @param params.destinationAbbrev - Optional destination filter
 * @returns status, journeys, and pageResolutionByTripId for rendering
 */
export const useScheduledTripsPageData = ({
  terminalAbbrev,
  destinationAbbrev,
}: UseScheduledTripsPageDataParams): UseScheduledTripsPageDataResult => {
  const sailingDay = getSailingDay(new Date());

  const { activeVesselTrips } = useConvexVesselTrips();
  const { vesselLocations } = useConvexVesselLocations();
  // Hold-window logic: synced trip/location during the 30s delay for consistent UX.
  const { displayData } = useDelayedVesselTrips(
    activeVesselTrips,
    vesselLocations
  );

  const trips = useQuery(
    api.functions.scheduledTrips.queries.getScheduledTripsForTerminal,
    {
      terminalAbbrev,
      destinationAbbrev,
      sailingDay,
    }
  );

  const journeys = trips
    ? trips.map((trip) => ({
        ...trip,
        segments: trip.segments.map(toSegment),
      }))
    : undefined;

  const departingTerminalAbbrevs =
    trips == null
      ? []
      : [
          ...new Set(
            trips.flatMap((t) =>
              t.segments.map((s) => s.DepartingTerminalAbbrev)
            )
          ),
        ];

  const rawCompletedTrips = useQuery(
    api.functions.vesselTrips.queries
      .getCompletedTripsForSailingDayAndTerminals,
    departingTerminalAbbrevs.length > 0
      ? { sailingDay, departingTerminalAbbrevs }
      : "skip"
  );

  const completedTrips = rawCompletedTrips?.map(toDomainVesselTrip) ?? [];

  const { vesselTripMap, vesselLocationByAbbrev, displayTripByAbbrev } =
    buildAllPageMaps(
      completedTrips,
      activeVesselTrips,
      vesselLocations,
      displayData
    );

  // One resolution per journey id; each card receives pre-resolved data to avoid per-card fetch.
  const pageResolutionByTripId =
    journeys == null
      ? new Map<string, ScheduledTripCardResolution>()
      : resolveScheduledTripsPageResolution({
          terminalAbbrev,
          journeys,
          vesselLocationByAbbrev,
          displayTripByAbbrev,
          vesselTripMap,
        });

  const status: UseScheduledTripsPageDataResult["status"] =
    trips === undefined ? "loading" : trips.length === 0 ? "empty" : "ready";

  return {
    status,
    journeys,
    pageResolutionByTripId,
  };
};
