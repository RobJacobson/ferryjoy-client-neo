import { lineString } from "@turf/turf";
import type { VesselPing } from "@/domain/vessels/vesselPing";

/**
 * Creates a smoothed line using D3.js basis curve interpolation
 * Generates a B-spline that approximates rather than interpolates through points
 *
 * @param pings - Array of vessel ping data
 * @param currentPosition - Optional current smoothed position [longitude, latitude]
 * @returns GeoJSON LineString feature with smoothed coordinates
 */
export const createSmoothedLineWithD3 = (
  pings: VesselPing[],
  currentPosition?: [number, number]
) => {
  // Filter out pings that are less than 30 seconds old
  const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
  const filteredPings = pings.filter(
    (ping) => ping.TimeStamp <= thirtySecondsAgo
  );

  // Skip if we don't have enough points
  if (!filteredPings || filteredPings.length < 2) {
    return null;
  }

  // Convert to GeoJSON LineString coordinates [longitude, latitude]
  const coordinates: [number, number][] = filteredPings.map((ping) => [
    ping.Longitude,
    ping.Latitude,
  ]);

  // Prepend the current smoothed position if provided
  if (currentPosition) {
    coordinates.unshift(currentPosition);
  }

  // Limit to a reasonable number of points for performance
  const maxPoints = 50;
  if (coordinates.length > maxPoints) {
    coordinates.splice(maxPoints);
  }

  // Create D3 line generator with basis curve interpolation (not used in current implementation)
  // const lineGenerator = line()
  //   .x((d: [number, number]) => d[0]) // longitude
  //   .y((d: [number, number]) => d[1]) // latitude
  //   .curve(curveBasis); // Creates B-spline that doesn't pass through all points

  // Generate the path string (not used but kept for potential future use)
  // const pathString = lineGenerator(coordinates);

  // Convert back to GeoJSON LineString
  return lineString(coordinates);
};
