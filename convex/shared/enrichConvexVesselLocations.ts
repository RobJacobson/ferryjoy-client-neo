/**
 * Enriches raw converted vessel locations with terminal-distance fields.
 *
 * `toConvexVesselLocation()` intentionally produces a pre-enrichment shape
 * that mirrors the upstream WSF payload plus local normalization. The
 * persisted `ConvexVesselLocation` schema is stricter: `DepartingDistance`
 * must be present after enrichment, while `ArrivingDistance` remains optional
 * because some live vessel records do not include an arriving terminal.
 */
import type {
  ConvexVesselLocation,
  RawConvexVesselLocation,
} from "functions/vesselLocation/schemas";
import { calculateDistanceInMiles } from "shared/distanceUtils";
import { terminalLocations } from "./terminalLocations";

/**
 * Adds departing and arriving distance fields to a raw vessel location.
 *
 * This is the boundary where we turn the permissive pre-enrichment transport
 * shape into the stricter persisted storage shape.
 *
 * @param location - Converted vessel location before distance enrichment
 * @returns Vessel location with terminal distance fields populated
 * @throws When the departing terminal distance cannot be computed
 */
export const enrichConvexVesselLocation = (
  location: RawConvexVesselLocation
): ConvexVesselLocation => {
  const departingTerminal = terminalLocations[location.DepartingTerminalAbbrev];
  const arrivingTerminal = location.ArrivingTerminalAbbrev
    ? terminalLocations[location.ArrivingTerminalAbbrev]
    : undefined;
  const departingDistance = calculateDistanceInMiles(
    location.Latitude,
    location.Longitude,
    departingTerminal?.Latitude,
    departingTerminal?.Longitude
  );

  if (departingDistance === undefined) {
    throw new Error(
      `Missing departing terminal distance for ${location.DepartingTerminalAbbrev}`
    );
  }

  return {
    ...location,
    DepartingDistance: departingDistance,
    ArrivingDistance: calculateDistanceInMiles(
      location.Latitude,
      location.Longitude,
      arrivingTerminal?.Latitude,
      arrivingTerminal?.Longitude
    ),
  };
};
