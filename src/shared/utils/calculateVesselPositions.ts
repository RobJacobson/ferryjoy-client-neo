import { distance } from "@turf/turf";
import type { VesselLocation } from "ws-dottie/wsf-vessels";
import {
  createVesselWithProjection,
  PROJECTION_TIME_MS,
} from "./projectVesselPosition";

// Animation timing constants
export const SMOOTHING_INTERVAL_MS = 1000; // Update animation every second
export const SMOOTHING_PERIOD_MS = 15000; // 15-second smoothing window
export const NEW_WEIGHT = SMOOTHING_INTERVAL_MS / SMOOTHING_PERIOD_MS; // 0.067 (6.7% new data weight)
export const PREV_WEIGHT = 1 - NEW_WEIGHT; // 0.933 (93.3% previous data weight)

// Teleportation detection timing
export const TELEPORTATION_CHECK_INTERVAL_MS = 100; // Check for teleportation every 100ms

// Thresholds for vessel behavior
export const TELEPORT_THRESHOLD_KM = 0.5; // Detect teleportation beyond 500m
export const COORDINATE_PRECISION = 6; // ~1 meter precision (6 decimal places)
export const HEADING_THRESHOLD_DEGREES = 45; // Snap to new heading if >45° difference

// Type for vessels with projection data
export type VesselWithProjection = VesselLocation & {
  ProjectedLatitude?: number;
  ProjectedLongitude?: number;
  ProjectionTimestamp?: number;
};

type VesselsRecord = Record<number, VesselWithProjection>;

/**
 * Identifies and adds newly appeared vessels to the animation system.
 *
 * Compares current vessel data with animated vessels to find vessels
 * that have appeared but aren't yet being animated. These new vessels
 * are added to the animation system with projected positions for immediate animation.
 *
 * @param animatedVessels Currently animated vessels
 * @param currentVessels Latest vessel location data
 * @returns Array of new vessels to add with projection data
 */
export const getNewVessels = (
  animatedVessels: VesselWithProjection[],
  currentVessels: VesselLocation[]
): VesselWithProjection[] => {
  const animatedVesselsSet = toVesselsSet(animatedVessels);
  return currentVessels
    .filter((vessel) => !animatedVesselsSet.has(vessel.VesselID))
    .map((vessel) => createVesselWithProjection(vessel));
};

/**
 * Safe wrapper for animateVessels that provides graceful degradation on errors.
 *
 * If animation succeeds, returns smoothly animated vessel positions.
 * If animation fails, logs the error and returns current vessel positions as fallback.
 * This ensures the map continues to show vessel positions even if animation logic fails.
 *
 * @param animatedVessels Currently smoothed vessel positions
 * @param currentVessels Latest GPS vessel location data
 * @returns Either animated vessels or current vessels as fallback
 */
export const animateVesselsSafe = (
  animatedVessels: VesselWithProjection[],
  currentVessels: VesselLocation[]
): VesselWithProjection[] => {
  try {
    return animateVessels(animatedVessels, currentVessels);
  } catch (error) {
    console.error(
      "Animation failed, falling back to current vessel positions",
      {
        error: error instanceof Error ? error.message : String(error),
        animatedVesselCount: animatedVessels.length,
        currentVesselCount: currentVessels.length,
      }
    );
    return currentVessels.map((vessel) => createVesselWithProjection(vessel));
  }
};

/**
 * Converts an array of vessels to a Set of VesselIDs for efficient O(1) lookups.
 * Used to quickly check if a vessel is already being animated.
 *
 * @param vessels Array of vessel locations
 * @returns Set of VesselIDs
 */
export const toVesselsSet = (vessels: VesselWithProjection[]): Set<number> =>
  new Set(vessels.map((vessel) => vessel.VesselID));

/**
 * Checks for vessel teleportation and immediately updates vessels that have teleported.
 *
 * This function runs more frequently than the main animation loop to detect
 * sudden position changes (teleportation) and immediately update those vessels
 * to prevent awkward pauses before teleportation is handled.
 *
 * @param animatedVessels Currently animated vessels
 * @param currentVessels Latest vessel location data
 * @returns Updated vessels with teleportation handled
 */
export const checkForTeleportation = (
  animatedVessels: VesselWithProjection[],
  currentVessels: VesselLocation[]
): VesselWithProjection[] => {
  const currentVesselsRecord = toVesselsRecord(currentVessels);

  return animatedVessels.map((smoothedVessel) => {
    const currentVessel = currentVesselsRecord[smoothedVessel.VesselID];

    // Keep existing vessel if no current data available
    if (!currentVessel) {
      return smoothedVessel;
    }

    // Detect teleportation (sudden large position changes)
    if (
      calculateDistance(smoothedVessel, currentVessel) > TELEPORT_THRESHOLD_KM
    ) {
      // Create new vessel with projection when teleportation is detected
      return createVesselWithProjection(currentVessel);
    }

    // Return unchanged vessel if no teleportation detected
    return smoothedVessel;
  });
};

/**
 * Applies exponential smoothing to vessel positions for fluid map animations.
 *
 * Creates smooth transitions between GPS updates by blending current and previous
 * positions. Uses 93.3% previous position + 6.7% current position for natural
 * movement. Animates toward projected positions to ensure continuous movement.
 * Note: Teleportation detection is now handled separately by checkForTeleportation().
 *
 * @param animatedVessels Currently smoothed vessel positions
 * @param currentVessels Latest GPS vessel location data
 * @returns Array of smoothly animated vessel positions
 */
export const animateVessels = (
  animatedVessels: VesselWithProjection[],
  currentVessels: VesselLocation[]
): VesselWithProjection[] => {
  const currentVesselsRecord = toVesselsRecord(currentVessels);
  return animatedVessels
    .map((smoothedVessel) => {
      try {
        const currentVessel = currentVesselsRecord[smoothedVessel.VesselID];

        // Keep existing vessel if no current data available
        if (!currentVessel) {
          return smoothedVessel;
        }

        // Check if we need to update the projection
        const now = Date.now();
        const shouldUpdateProjection =
          !smoothedVessel.ProjectionTimestamp ||
          now - smoothedVessel.ProjectionTimestamp > PROJECTION_TIME_MS;

        // Get target position (current or projected)
        let targetLatitude = currentVessel.Latitude;
        let targetLongitude = currentVessel.Longitude;

        if (shouldUpdateProjection) {
          // Create new projection
          const vesselWithProjection =
            createVesselWithProjection(currentVessel);
          targetLatitude =
            vesselWithProjection.ProjectedLatitude || currentVessel.Latitude;
          targetLongitude =
            vesselWithProjection.ProjectedLongitude || currentVessel.Longitude;

          // Return vessel with updated projection
          return {
            ...currentVessel,
            Latitude: smoothCoordinate(
              smoothedVessel.Latitude,
              currentVessel.Latitude
            ),
            Longitude: smoothCoordinate(
              smoothedVessel.Longitude,
              currentVessel.Longitude
            ),
            Heading: smoothHeading(
              smoothedVessel.Heading,
              currentVessel.Heading
            ),
            ProjectedLatitude: vesselWithProjection.ProjectedLatitude,
            ProjectedLongitude: vesselWithProjection.ProjectedLongitude,
            ProjectionTimestamp: vesselWithProjection.ProjectionTimestamp,
          };
        }

        // Use existing projection if available
        if (
          smoothedVessel.ProjectedLatitude &&
          smoothedVessel.ProjectedLongitude
        ) {
          targetLatitude = smoothedVessel.ProjectedLatitude;
          targetLongitude = smoothedVessel.ProjectedLongitude;
        }

        // Apply exponential smoothing to coordinates and heading
        return {
          ...currentVessel,
          Latitude: smoothCoordinate(smoothedVessel.Latitude, targetLatitude),
          Longitude: smoothCoordinate(
            smoothedVessel.Longitude,
            targetLongitude
          ),
          Heading: smoothHeading(smoothedVessel.Heading, currentVessel.Heading),
          ProjectedLatitude: smoothedVessel.ProjectedLatitude,
          ProjectedLongitude: smoothedVessel.ProjectedLongitude,
          ProjectionTimestamp: smoothedVessel.ProjectionTimestamp,
        };
      } catch (error) {
        console.error("Error animating vessel", {
          vesselId: smoothedVessel.VesselID,
          error: error instanceof Error ? error.message : String(error),
        });
        return undefined;
      }
    })
    .filter((vessel): vessel is VesselWithProjection => vessel !== undefined);
};

/**
 * Converts an array of vessels to a record for efficient O(1) lookups.
 * Used to avoid O(n²) complexity when finding current vessel data.
 *
 * @param vessels Array of vessel locations
 * @returns Record mapping VesselID to VesselLocation
 */
export const toVesselsRecord = (vessels: VesselLocation[]): VesselsRecord =>
  vessels.reduce((acc, vessel) => {
    acc[vessel.VesselID] = createVesselWithProjection(vessel);
    return acc;
  }, {} as VesselsRecord);

/**
 * Calculates great circle distance between two vessel positions using Turf.js.
 *
 * Uses accurate geodesic calculations for precise distance measurement.
 * More reliable than simplified Euclidean distance for geographic coordinates.
 *
 * @param vp1 First vessel position
 * @param vp2 Second vessel position
 * @returns Distance in kilometers
 */
export const calculateDistance = (
  vp1: VesselLocation | VesselWithProjection,
  vp2: VesselLocation | VesselWithProjection
): number =>
  distance([vp1.Longitude, vp1.Latitude], [vp2.Longitude, vp2.Latitude], {
    units: "kilometers",
  });

/**
 * Applies exponential smoothing to geographic coordinates.
 *
 * Blends previous and current coordinates using weighted average for smooth
 * transitions. Rounds to 6 decimal places (~1 meter precision) to prevent
 * floating-point precision issues while maintaining sufficient accuracy.
 *
 * @param prevCoord Previous coordinate value
 * @param currentCoord Current coordinate value
 * @returns Smoothed coordinate rounded to specified precision
 */
export const smoothCoordinate = (
  prevCoord: number,
  currentCoord: number
): number => {
  // Apply exponential smoothing: 93.3% previous + 6.7% current
  const smoothed = PREV_WEIGHT * prevCoord + NEW_WEIGHT * currentCoord;

  // Round to specified decimal places to prevent precision drift
  const factor = 10 ** COORDINATE_PRECISION;
  return Math.round(smoothed * factor) / factor;
};

/**
 * Applies intelligent smoothing to vessel heading values.
 *
 * Handles circular nature of heading values (0-360°) by calculating shortest
 * angular distance. Snaps to new heading if difference exceeds threshold,
 * otherwise applies exponential smoothing. Normalizes result to 0-360° range.
 *
 * @param previousHeading Previous heading value (0-360°)
 * @param currentHeading Current heading value (0-360°)
 * @returns Smoothed heading value (0-360°)
 */
export const smoothHeading = (
  previousHeading: number,
  currentHeading: number
): number => {
  // Use current heading if no previous value exists
  if (!previousHeading) {
    return currentHeading;
  }

  // Calculate shortest angular distance (handles 0°/360° wrap-around)
  const diff = Math.abs(currentHeading - previousHeading);
  const shortestDiff = diff > 180 ? 360 - diff : diff;

  // Snap to new heading if difference exceeds threshold
  if (shortestDiff > HEADING_THRESHOLD_DEGREES) {
    return currentHeading;
  }

  // Apply exponential smoothing and normalize to 0-360° range
  const smoothed = smoothCoordinate(previousHeading, currentHeading);
  const normalized = ((smoothed % 360) + 360) % 360;
  return Math.round(normalized * 100) / 100; // Round to 0.01° precision
};
