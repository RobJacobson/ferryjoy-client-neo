/**
 * Hook for resolving vessel location and trip data for scheduled trip timeline display.
 * Fetches active trips, vessel locations, delayed/hold-window data, and completed trips,
 * then builds a vesselTripMap and resolves the synchronized vessel location.
 */

import { api } from "convex/_generated/api";
import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { toDomainVesselTrip } from "convex/functions/vesselTrips/schemas";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import { useConvexVesselLocations } from "@/data/contexts/convex/ConvexVesselLocationsContext";
import { useConvexVesselTrips } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { createVesselTripMap } from "../Timeline/utils";
import { useDelayedVesselTrips } from "../VesselTrips/useDelayedVesselTrips";

type UseScheduledTripDisplayDataParams = {
  /** Vessel abbreviation for the trip. */
  vesselAbbrev: string;
  /** WSF operational day YYYY-MM-DD; used for completed trip lookups. */
  sailingDay?: string;
  /** Departing terminal abbrevs for completed trip lookups. */
  departingTerminalAbbrevs?: string[];
};

type UseScheduledTripDisplayDataResult = {
  /** Resolved vessel location (synchronized from displayData or live). */
  vesselLocation: VesselLocation | undefined;
  /**
   * Trip currently being displayed for this vessel (active or held during the 30s window).
   * This is the authoritative trip identity for determining the active timeline segment.
   */
  displayTrip: VesselTrip | undefined;
  /** Map of trip Key to VesselTrip for O(1) lookup. */
  vesselTripMap: Map<string, VesselTrip>;
};

/**
 * Resolves vessel location and vessel trip map for scheduled trip timeline display.
 *
 * Fetches active trips, vessel locations, applies hold-window logic via useDelayedVesselTrips,
 * fetches completed trips for the sailing day, and builds a unified vesselTripMap.
 * Resolves vesselLocation from synchronized displayData (for correct trip state during hold)
 * or falls back to live vessel location.
 *
 * @param params - Vessel abbrev, sailing day, and departing terminals for completed trip query
 * @returns vesselLocation and vesselTripMap for timeline rendering
 */
export const useScheduledTripDisplayData = ({
  vesselAbbrev,
  sailingDay,
  departingTerminalAbbrevs = [],
}: UseScheduledTripDisplayDataParams): UseScheduledTripDisplayDataResult => {
  const { activeVesselTrips } = useConvexVesselTrips();
  const { vesselLocations } = useConvexVesselLocations();
  const { displayData } = useDelayedVesselTrips(
    activeVesselTrips,
    vesselLocations
  );

  const rawCompletedTrips = useQuery(
    api.functions.vesselTrips.queries
      .getCompletedTripsForSailingDayAndTerminals,
    sailingDay && departingTerminalAbbrevs.length > 0
      ? { sailingDay, departingTerminalAbbrevs }
      : "skip"
  );
  const completedTrips = rawCompletedTrips?.map(toDomainVesselTrip) ?? [];

  // Index vessel trips by Key for O(1) lookup. Historical (completed) first,
  // then active, then displayData so current/held state wins.
  const vesselTripMap = useMemo(() => {
    const map = createVesselTripMap(completedTrips);
    for (const trip of activeVesselTrips) {
      if (trip.Key) map.set(trip.Key, trip);
    }
    for (const d of displayData) {
      if (d.trip.Key) map.set(d.trip.Key, d.trip);
    }
    return map;
  }, [completedTrips, activeVesselTrips, displayData]);

  // Find the synchronized vessel location from displayData
  const synchronizedData = displayData.find(
    (d) => d.trip.VesselAbbrev === vesselAbbrev
  );

  // Fallback to live location if no synchronized data is found (e.g. vessel not in a trip)
  const vesselLocation =
    synchronizedData?.vesselLocation ||
    vesselLocations.find((v) => v.VesselAbbrev === vesselAbbrev);

  return {
    vesselLocation,
    displayTrip: synchronizedData?.trip,
    vesselTripMap,
  };
};
