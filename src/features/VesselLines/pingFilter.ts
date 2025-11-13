import type { VesselPing } from "@/domain/vessels/vesselPing";

/**
 * Filters vessel pings by replacing the first ping with the current position.
 *
 * @param pings - Array of vessel ping data
 * @param currentPosition - Current smoothed position [longitude, latitude]
 * @returns Array of [longitude, latitude] coordinates
 */
export const filterVesselPings = (
  pings: VesselPing[],
  currentPosition?: [number, number]
): [number, number][] => {
  // If no pings or no current position, return empty array
  if (!pings.length || !currentPosition) {
    return [];
  }

  // Create new array with current position followed by pings (excluding the first one)
  const pingsToUse = pings.slice(1); // Drop the first ping
  const coordinates: [number, number][] = [
    currentPosition,
    ...pingsToUse.map(
      (ping) => [ping.Longitude, ping.Latitude] as [number, number]
    ),
  ];

  return coordinates;
};
