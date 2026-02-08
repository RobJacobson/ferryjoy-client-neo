/**
 * Pure helpers for building ScheduledTrips page-level maps.
 * Merges completed trips, active trips, and displayData (hold window) with
 * precedence: completed first, then active, then displayData wins per key/vessel.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { createVesselTripMap } from "../../Timeline/utils";

/** Display data item shape from useDelayedVesselTrips (trip + synced location). */
type DisplayDataItem = { trip: VesselTrip; vesselLocation: VesselLocation };

/**
 * Builds a unified vessel trip map: completed first, then active, then displayData (held) wins.
 *
 * @param completedTrips - Completed trips for the sailing day/terminals
 * @param activeVesselTrips - Current active trips from Convex
 * @param displayData - Hold-window display data (trip + synced location per vessel)
 * @returns Map of trip Key to VesselTrip for O(1) lookup
 */
const buildVesselTripMap = (
  completedTrips: VesselTrip[],
  activeVesselTrips: VesselTrip[],
  displayData: DisplayDataItem[]
): Map<string, VesselTrip> => {
  const map = createVesselTripMap(completedTrips);
  // Active trips overlay completed; displayData (hold window) wins over both for same Key.
  for (const trip of activeVesselTrips) {
    if (trip.Key) map.set(trip.Key, trip);
  }
  for (const d of displayData) {
    if (d.trip.Key) map.set(d.trip.Key, d.trip);
  }
  return map;
};

/**
 * Builds vessel location by abbrev: live locations with synced overlay from displayData.
 *
 * @param vesselLocations - Live vessel locations from Convex
 * @param displayData - Hold-window data (synced location wins per vessel)
 * @returns Map of vessel abbrev to VesselLocation
 */
const buildVesselLocationByAbbrev = (
  vesselLocations: VesselLocation[],
  displayData: DisplayDataItem[]
): Map<string, VesselLocation> => {
  const synced = new Map<string, VesselLocation>();
  for (const d of displayData) {
    synced.set(d.trip.VesselAbbrev, d.vesselLocation);
  }
  // Per vessel: use synced location when in hold window, otherwise live location.
  return new Map(
    vesselLocations.map((loc) => [
      loc.VesselAbbrev,
      synced.get(loc.VesselAbbrev) ?? loc,
    ])
  );
};

/**
 * Builds display trip by vessel abbrev from hold-window displayData.
 *
 * @param displayData - Hold-window data (trip per vessel)
 * @returns Map of vessel abbrev to VesselTrip
 */
const buildDisplayTripByAbbrev = (
  displayData: DisplayDataItem[]
): Map<string, VesselTrip> =>
  new Map(displayData.map((d) => [d.trip.VesselAbbrev, d.trip]));

/** Result of building all page-level maps (single precedence: completed → active → held). */
export type PageMaps = {
  vesselTripMap: Map<string, VesselTrip>;
  vesselLocationByAbbrev: Map<string, VesselLocation>;
  displayTripByAbbrev: Map<string, VesselTrip>;
};

/**
 * Builds all page-level maps in one call. Same precedence as individual builders:
 * completed trips first, then active, then displayData (hold window) wins.
 *
 * @param completedTrips - Completed trips for the sailing day/terminals
 * @param activeVesselTrips - Current active trips from Convex
 * @param vesselLocations - Live vessel locations from Convex
 * @param displayData - Hold-window display data (trip + synced location per vessel)
 * @returns vesselTripMap, vesselLocationByAbbrev, and displayTripByAbbrev
 */
export const buildAllPageMaps = (
  completedTrips: VesselTrip[],
  activeVesselTrips: VesselTrip[],
  vesselLocations: VesselLocation[],
  displayData: DisplayDataItem[]
): PageMaps => ({
  vesselTripMap: buildVesselTripMap(
    completedTrips,
    activeVesselTrips,
    displayData
  ),
  vesselLocationByAbbrev: buildVesselLocationByAbbrev(
    vesselLocations,
    displayData
  ),
  displayTripByAbbrev: buildDisplayTripByAbbrev(displayData),
});
