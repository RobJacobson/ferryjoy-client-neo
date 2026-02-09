/**
 * Single place for ScheduledTrips page-level map construction.
 * Uses Convex vessel trips/locations, delayed (hold-window) display data, and
 * completed-trips query; merges via buildAllPageMaps. Used by useScheduledTripsPageData.
 */

import { api } from "convex/_generated/api";
import { toDomainVesselTrip } from "convex/functions/vesselTrips/schemas";
import { useQuery } from "convex/react";
import { useConvexVesselLocations } from "@/data/contexts/convex/ConvexVesselLocationsContext";
import { useConvexVesselTrips } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { useDelayedVesselTrips } from "../VesselTrips/useDelayedVesselTrips";
import { buildAllPageMaps, type PageMaps } from "./utils/buildPageDataMaps";

type UseScheduledTripsMapsParams = {
  /** WSF operational day YYYY-MM-DD; used for completed trip lookups. */
  sailingDay: string;
  /** Departing terminal abbrevs for completed trip lookups. */
  departingTerminalAbbrevs: string[];
};

/**
 * Builds vessel trip map, vessel location by abbrev, and display trip by abbrev
 * for the ScheduledTrips list. Single source for map construction.
 *
 * Uses active vessel trips, vessel locations, delayed/hold-window data, and
 * completed trips for the sailing day/terminals, then merges via buildAllPageMaps.
 *
 * @param sailingDay - WSF operational day (YYYY-MM-DD) for completed-trip lookups
 * @param departingTerminalAbbrevs - Departing terminal abbrevs for completed-trip query
 * @returns PageMaps when ready; null while completed-trips query is loading (when terminals non-empty)
 */
export const useScheduledTripsMaps = ({
  sailingDay,
  departingTerminalAbbrevs,
}: UseScheduledTripsMapsParams): PageMaps | null => {
  const { activeVesselTrips } = useConvexVesselTrips();
  const { vesselLocations } = useConvexVesselLocations();
  const { displayData } = useDelayedVesselTrips(
    activeVesselTrips,
    vesselLocations
  );

  const rawCompletedTrips = useQuery(
    api.functions.vesselTrips.queries
      .getCompletedTripsForSailingDayAndTerminals,
    departingTerminalAbbrevs.length > 0
      ? { sailingDay, departingTerminalAbbrevs }
      : "skip"
  );

  const completedTrips = rawCompletedTrips?.map(toDomainVesselTrip) ?? [];

  // Return null while completed-trips are loading (when we requested them).
  if (departingTerminalAbbrevs.length > 0 && rawCompletedTrips === undefined) {
    return null;
  }

  return buildAllPageMaps(
    completedTrips,
    activeVesselTrips,
    vesselLocations,
    displayData
  );
};
