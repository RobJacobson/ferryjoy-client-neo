import type { VesselLocation, VesselPing } from "@/domain";
import { VESSEL_LINE_CONFIG } from "../config";

/**
 * Filters vessel pings by replacing first ping with current position.
 *
 * @param pings - Array of vessel ping data
 * @param currentPosition - Current smoothed position object with Longitude and Latitude
 * @returns Array of [longitude, latitude] coordinates
 */
export const filterVesselPings = (
  pings: VesselPing[],
  currentPosition?: VesselLocation
): [number, number][] => {
  // If no pings or no current position, return empty array
  if (!pings.length || !currentPosition) {
    return [];
  }

  // Use time window from configuration
  const timeWindowAgo = new Date(
    Date.now() - VESSEL_LINE_CONFIG.filtering.timeWindowMs
  );

  // Find start index (skip first ping if it's within the time window)
  const startIndex =
    pings.length > 0 && pings[0].TimeStamp >= timeWindowAgo ? 1 : 0;

  // Find end index (first at-dock ping, or end of array)
  const firstAtDockIndex = pings.findIndex((ping) => ping.AtDock);
  const endIndex =
    !currentPosition.AtDock && firstAtDockIndex !== -1
      ? firstAtDockIndex + 1
      : pings.length;

  // Slice array in one operation
  const filteredPings = pings.slice(startIndex, endIndex);

  // Create new array with current position followed by filtered pings
  const coordinates: [number, number][] = [
    [currentPosition.Longitude, currentPosition.Latitude],
    ...filteredPings.map(
      (ping) => [ping.Longitude, ping.Latitude] as [number, number]
    ),
  ];

  return coordinates;
};
