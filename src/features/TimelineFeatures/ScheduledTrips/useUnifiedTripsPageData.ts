/**
 * Hook that resolves page data for ScheduledTrips from UnifiedTripsContext.
 *
 * Consumes useUnifiedTrips(), integrates hold window via useDelayedVesselTrips,
 * and produces journeys, vesselTripMap, and display maps for presentational components.
 * Must be used within UnifiedTripsProvider.
 */

import type { ScheduledTrip } from "convex/functions/scheduledTrips/schemas";
import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type {
  VesselTrip,
  VesselTripWithScheduledTrip,
} from "convex/functions/vesselTrips/schemas";
import { useUnifiedTrips } from "@/data/contexts";
import { useConvexVesselLocations } from "@/data/contexts/convex/ConvexVesselLocationsContext";
import { useDelayedVesselTrips } from "../shared/useDelayedVesselTrips";
import type { ScheduledTripJourney } from "./types";
import { buildAllPageMaps } from "./utils/buildPageDataMaps";
import { reconstructJourneys } from "./utils/reconstructJourneys";

type UseUnifiedTripsPageDataParams = {
  /** Departure terminal to filter journeys (e.g. "P52") */
  terminalAbbrev: string;
  /** Optional destination terminal to filter trips */
  destinationAbbrev?: string;
};

type UseUnifiedTripsPageDataResult = {
  status: "loading" | "empty" | "ready";
  journeys: ScheduledTripJourney[] | undefined;
  /**
   * Map of segment Key to VesselTrip for O(1) lookup. Used with PrevKey/NextKey for prev/next trips.
   */
  vesselTripMap: Map<string, VesselTrip>;
  /**
   * Vessel location map used during render for real-time status/phase and bar animations.
   */
  vesselLocationByAbbrev: Map<string, VesselLocation>;
  /**
   * Held trip map used to preserve UX identity during arrival transitions.
   */
  displayTripByAbbrev: Map<string, VesselTrip>;
};

type UnifiedTripForActive = {
  activeVesselTrip?: VesselTrip;
  scheduledTrip?: ScheduledTrip;
};

/**
 * Builds active trips with ScheduledTrip for useDelayedVesselTrips.
 * UnifiedTrip has both activeVesselTrip and scheduledTrip; we merge them.
 *
 * @param unifiedTrips - Record of unified trips
 * @returns Array of VesselTripWithScheduledTrip
 */
const buildActiveTripsWithScheduled = (
  unifiedTrips: Record<string, UnifiedTripForActive>
): VesselTripWithScheduledTrip[] =>
  Object.values(unifiedTrips)
    .filter(
      (u): u is UnifiedTripForActive & { activeVesselTrip: VesselTrip } =>
        !!u.activeVesselTrip
    )
    .map((u) => ({
      ...u.activeVesselTrip,
      ScheduledTrip: u.scheduledTrip,
    }));

/**
 * Resolves page data from UnifiedTripsContext for ScheduledTrips display.
 *
 * Extracts scheduled, active, and completed trips from unifiedTrips; integrates
 * hold window via useDelayedVesselTrips; builds vesselTripMap and location maps;
 * reconstructs journeys via reconstructJourneys.
 *
 * @param terminalAbbrev - Departure terminal to filter journeys
 * @param destinationAbbrev - Optional destination terminal to filter trips
 * @returns Object with status, journeys, vesselTripMap, vesselLocationByAbbrev, displayTripByAbbrev
 */
export const useUnifiedTripsPageData = ({
  terminalAbbrev,
  destinationAbbrev,
}: UseUnifiedTripsPageDataParams): UseUnifiedTripsPageDataResult => {
  const { unifiedTrips, isLoading: unifiedLoading } = useUnifiedTrips();
  const { vesselLocations } = useConvexVesselLocations();

  const scheduledTrips = Object.values(unifiedTrips).flatMap((u) =>
    u.scheduledTrip ? [u.scheduledTrip] : []
  );
  const activeVesselTrips = buildActiveTripsWithScheduled(unifiedTrips);
  const completedVesselTrips = Object.values(unifiedTrips).flatMap((u) =>
    u.completedVesselTrip ? [u.completedVesselTrip] : []
  );

  const { displayData } = useDelayedVesselTrips(
    activeVesselTrips,
    vesselLocations
  );

  const maps = buildAllPageMaps(
    completedVesselTrips,
    activeVesselTrips,
    vesselLocations,
    displayData
  );

  const journeys = reconstructJourneys(
    scheduledTrips,
    terminalAbbrev,
    destinationAbbrev
  );

  const status: UseUnifiedTripsPageDataResult["status"] = unifiedLoading
    ? "loading"
    : journeys.length === 0
      ? "empty"
      : "ready";

  return {
    status,
    journeys,
    vesselTripMap: maps.vesselTripMap,
    vesselLocationByAbbrev: maps.vesselLocationByAbbrev,
    displayTripByAbbrev: maps.displayTripByAbbrev,
  };
};
