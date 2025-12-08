import type { VesselLocation, VesselPing } from "@/domain";

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
  if (!pings.length || !currentPosition) {
    return [];
  }

  const startIndex = currentPosition.TimeStamp > pings[0].TimeStamp ? 0 : 1;
  const combinedPings = [currentPosition, ...pings.slice(startIndex)];

  const lastAtDockIndex = combinedPings.findIndex((ping) => ping.AtDock);
  const endIndex =
    currentPosition.AtDock || lastAtDockIndex < 0
      ? combinedPings.length
      : lastAtDockIndex + 1;

  return combinedPings
    .slice(0, endIndex)
    .map((ping) => [ping.Longitude, ping.Latitude] as [number, number]);
};
