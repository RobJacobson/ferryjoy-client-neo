import { destination } from "@turf/turf";
import type { VesselLocation } from "ws-dottie/wsf-vessels";

// Projection time window in milliseconds
export const PROJECTION_TIME_MS = 15000; // 15 seconds

/**
 * Projects a vessel's position based on its current location, speed, and heading.
 *
 * This function calculates where a vessel will be after PROJECTION_TIME_MS milliseconds
 * based on its current speed and heading using geodesic calculations.
 *
 * @param vessel The vessel location data with current position, speed, and heading
 * @returns A new VesselLocation object with projected coordinates
 */
export const projectVesselPosition = (
  vessel: VesselLocation
): VesselLocation => {
  // If vessel is stationary or has invalid data, return current position
  if (!vessel.Speed || vessel.Speed <= 0 || !vessel.Heading) {
    return vessel;
  }

  try {
    // Convert speed from knots to km/h for projection
    const speedKmPerHour = vessel.Speed * 1.852; // 1 knot = 1.852 km/h
    const speedKmPerSecond = speedKmPerHour / 3600;
    const distanceKm = speedKmPerSecond * (PROJECTION_TIME_MS / 1000);

    // Calculate projected position using Turf.js destination function
    const projectedPoint = destination(
      [vessel.Longitude, vessel.Latitude],
      distanceKm,
      vessel.Heading,
      { units: "kilometers" }
    );

    // Return a new vessel object with projected coordinates
    return {
      ...vessel,
      Latitude: projectedPoint.geometry.coordinates[1],
      Longitude: projectedPoint.geometry.coordinates[0],
    };
  } catch (error) {
    console.error("Error projecting vessel position", {
      vesselId: vessel.VesselID,
      error: error instanceof Error ? error.message : String(error),
    });
    return vessel; // Return original position if projection fails
  }
};

/**
 * Projects multiple vessels' positions.
 *
 * @param vessels Array of vessel location data
 * @returns Array of vessels with projected positions
 */
export const projectVesselPositions = (
  vessels: VesselLocation[]
): VesselLocation[] => {
  return vessels.map((vessel) => projectVesselPosition(vessel));
};

/**
 * Creates a vessel with projected position data for animation.
 *
 * This function creates a new vessel object that includes both the current position
 * and the projected position for animation purposes.
 *
 * @param vessel The current vessel location data
 * @returns A vessel object with projection data
 */
export const createVesselWithProjection = (
  vessel: VesselLocation
): VesselLocation & {
  ProjectedLatitude?: number;
  ProjectedLongitude?: number;
  ProjectionTimestamp?: number;
} => {
  const projectedVessel = projectVesselPosition(vessel);

  // If the vessel is stationary, use current position as projection
  if (!vessel.Speed || vessel.Speed <= 0 || !vessel.Heading) {
    return {
      ...vessel,
      ProjectedLatitude: vessel.Latitude,
      ProjectedLongitude: vessel.Longitude,
      ProjectionTimestamp: Date.now(),
    };
  }

  return {
    ...vessel,
    ProjectedLatitude: projectedVessel.Latitude,
    ProjectedLongitude: projectedVessel.Longitude,
    ProjectionTimestamp: Date.now(),
  };
};
