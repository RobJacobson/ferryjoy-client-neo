/**
 * Distance Calculation Utilities
 *
 * Provides functions for calculating distances between geographical coordinates.
 */

import distance from "@turf/distance";
import { point } from "@turf/helpers";

/**
 * Calculates the distance between two points in miles, rounded to the nearest 1/1000th.
 *
 * @param lat1 - Latitude of the first point
 * @param lon1 - Longitude of the first point
 * @param lat2 - Latitude of the second point
 * @param lon2 - Longitude of the second point
 * @returns The distance in miles rounded to 3 decimal places, or null if coordinates are invalid
 */
export const calculateDistanceInMiles = (
  lat1: number | undefined | null,
  lon1: number | undefined | null,
  lat2: number | undefined | null,
  lon2: number | undefined | null
): number | undefined => {
  if (
    lat1 === undefined ||
    lat1 === null ||
    lon1 === undefined ||
    lon1 === null ||
    lat2 === undefined ||
    lat2 === null ||
    lon2 === undefined ||
    lon2 === null
  ) {
    return undefined;
  }

  try {
    const from = point([lon1, lat1]);
    const to = point([lon2, lat2]);
    const options = { units: "miles" as const };

    const dist = distance(from, to, options);

    // Round to nearest 1/1000th of a mile
    return Math.round(dist * 1000) / 1000;
  } catch (error) {
    console.error("Error calculating distance:", error);
    return undefined;
  }
};
