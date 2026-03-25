/**
 * Enriches converted vessel locations with distance-to-terminal fields.
 */
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { calculateDistanceInMiles } from "shared/distanceUtils";
import { terminalLocations } from "./terminalLocations";

/**
 * Adds departing and arriving distance fields to a vessel location.
 *
 * @param location - Converted vessel location before distance enrichment
 * @returns Vessel location with terminal distance fields populated
 */
export const enrichConvexVesselLocation = (
  location: ConvexVesselLocation
): ConvexVesselLocation => {
  const departingTerminal = terminalLocations[location.DepartingTerminalAbbrev];
  const arrivingTerminal = location.ArrivingTerminalAbbrev
    ? terminalLocations[location.ArrivingTerminalAbbrev]
    : undefined;

  return {
    ...location,
    DepartingDistance: calculateDistanceInMiles(
      location.Latitude,
      location.Longitude,
      departingTerminal?.Latitude,
      departingTerminal?.Longitude
    ),
    ArrivingDistance: calculateDistanceInMiles(
      location.Latitude,
      location.Longitude,
      arrivingTerminal?.Latitude,
      arrivingTerminal?.Longitude
    ),
  };
};
