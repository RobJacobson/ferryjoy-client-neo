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

/** Display data item shape from useDelayedVesselTrips (trip + synced location). */
type DisplayDataItem = { trip: VesselTrip; vesselLocation: VesselLocation };

/**
 * Builds page-level maps: vesselTripMap, vesselLocationByAbbrev, displayTripByAbbrev.
 * Precedence: completed first, then active, then displayData (hold window) wins.
 *
 * @param completedTrips - Completed trips from unified data
 * @param activeVesselTrips - Active trips from unified data
 * @param vesselLocations - Live vessel locations from Convex
 * @param displayData - Hold-window display data
 * @returns vesselTripMap, vesselLocationByAbbrev, displayTripByAbbrev
 */
const buildPageMaps = (
  completedTrips: VesselTrip[],
  activeVesselTrips: VesselTrip[],
  vesselLocations: VesselLocation[],
  displayData: DisplayDataItem[]
) => {
  const tripsWithKey = [
    ...completedTrips,
    ...activeVesselTrips,
    ...displayData.map((d) => d.trip),
  ]
    .filter((t): t is VesselTrip & { Key: string } => !!t.Key)
    .map((t) => [t.Key, t] as const);
  const vesselTripMap = new Map<string, VesselTrip>(tripsWithKey);

  const synced = new Map<string, VesselLocation>();
  for (const d of displayData) {
    synced.set(d.trip.VesselAbbrev, d.vesselLocation);
  }
  const vesselLocationByAbbrev = new Map(
    vesselLocations.map((loc) => [
      loc.VesselAbbrev,
      synced.get(loc.VesselAbbrev) ?? loc,
    ])
  );

  const displayTripByAbbrev = new Map(
    displayData.map((d) => [d.trip.VesselAbbrev, d.trip])
  );

  return { vesselTripMap, vesselLocationByAbbrev, displayTripByAbbrev };
};

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

  const maps = buildPageMaps(
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
