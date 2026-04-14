/**
 * Hook that resolves page data for ScheduledTrips from UnifiedTripsContext.
 *
 * Consumes useUnifiedTrips(), integrates hold window via useDelayedVesselTrips,
 * and produces journeys, vesselTripByKeys, and display maps for presentational components.
 * Must be used within UnifiedTripsProvider.
 */

import { useUnifiedTrips } from "@/data/contexts";
import { useConvexVesselLocations } from "@/data/contexts/convex/ConvexVesselLocationsContext";
import type {
  ScheduledTrip,
  VesselLocation,
  VesselTrip,
  VesselTripWithScheduledTrip,
} from "@/types";
import type { ScheduledTripJourney } from "../../ScheduledTrips/types";
import { useDelayedVesselTrips } from "..";
import { buildJourneyChains } from "../utils";

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
   * Map of schedule segment key (`ScheduleKey`) to VesselTrip for O(1) lookup.
   */
  vesselTripByKeys: Map<string, VesselTrip>;
  /**
   * Vessel location map used during render for real-time status/phase and bar animations.
   */
  vesselLocationByAbbrev: Map<string, VesselLocation>;
  /**
   * Held trip map used to preserve UX identity during arrival transitions.
   */
  currentTripByAbbrev: Map<string, VesselTrip>;
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
 * Builds page-level maps: vesselTripByKeys, vesselLocationByAbbrev, currentTripByAbbrev.
 * Precedence: completed first, then active, then displayData (hold window) wins.
 *
 * @param completedTrips - Completed trips from unified data
 * @param activeVesselTrips - Active trips from unified data
 * @param vesselLocations - Live vessel locations from Convex
 * @param displayData - Hold-window display data
 * @returns vesselTripByKeys, vesselLocationByAbbrev, currentTripByAbbrev
 */
const buildPageMaps = (
  completedTrips: VesselTrip[],
  activeVesselTrips: VesselTrip[],
  vesselLocations: VesselLocation[],
  displayData: DisplayDataItem[]
) => {
  const tripsWithScheduleKey = [
    ...completedTrips,
    ...activeVesselTrips,
    ...displayData.map((d) => d.trip),
  ]
    .filter((t): t is VesselTrip & { ScheduleKey: string } => !!t.ScheduleKey)
    .map((t) => [t.ScheduleKey, t] as const);
  const vesselTripByKeys = new Map<string, VesselTrip>(tripsWithScheduleKey);

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

  const currentTripByAbbrev = new Map(
    displayData.map((d) => [d.trip.VesselAbbrev, d.trip])
  );

  return { vesselTripByKeys, vesselLocationByAbbrev, currentTripByAbbrev };
};

/**
 * Resolves page data from UnifiedTripsContext for ScheduledTrips display.
 *
 * Extracts scheduled, active, and completed trips from unifiedTrips; integrates
 * hold window via useDelayedVesselTrips; builds vesselTripByKeys and location maps;
 * builds journey chains via buildJourneyChains.
 *
 * @param terminalAbbrev - Departure terminal to filter journeys
 * @param destinationAbbrev - Optional destination terminal to filter trips
 * @returns Object with status, journeys, vesselTripByKeys, vesselLocationByAbbrev, currentTripByAbbrev
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

  const journeys = buildJourneyChains(
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
    vesselTripByKeys: maps.vesselTripByKeys,
    vesselLocationByAbbrev: maps.vesselLocationByAbbrev,
    currentTripByAbbrev: maps.currentTripByAbbrev,
  };
};
