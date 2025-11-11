import { distance } from "@turf/turf";
import type { VesselLocation } from "ws-dottie/wsf-vessels";

// Animation timing constants
export const SMOOTHING_INTERVAL_MS = 1000; // Update animation every second
export const SMOOTHING_PERIOD_MS = 15000; // 15-second smoothing window
export const NEW_WEIGHT = SMOOTHING_INTERVAL_MS / SMOOTHING_PERIOD_MS; // 0.067 (6.7% new data weight)
export const PREV_WEIGHT = 1 - NEW_WEIGHT; // 0.933 (93.3% previous data weight)

// Thresholds for vessel behavior
export const TELEPORT_THRESHOLD_KM = 0.5; // Detect teleportation beyond 500m
export const COORDINATE_PRECISION = 6; // ~1 meter precision (6 decimal places)
export const HEADING_THRESHOLD_DEGREES = 45; // Snap to new heading if >45° difference

type VesselsRecord = Record<number, VesselLocation>;

/**
 * Identifies and adds newly appeared vessels to the animation system.
 *
 * Compares current vessel data with animated vessels to find vessels
 * that have appeared but aren't yet being animated. These new vessels
 * are added to the animation system without smoothing for immediate display.
 *
 * @param animatedVessels Currently animated vessels
 * @param currentVessels Latest vessel location data
 * @returns Array of new vessels to add
 */
export const getNewVessels = (
  animatedVessels: VesselLocation[],
  currentVessels: VesselLocation[]
): VesselLocation[] => {
  const animatedVesselsSet = toVesselsSet(animatedVessels);
  return currentVessels.filter(
    vessel => !animatedVesselsSet.has(vessel.VesselID)
  );
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
  animatedVessels: VesselLocation[],
  currentVessels: VesselLocation[]
): VesselLocation[] => {
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
    return currentVessels;
  }
};

/**
 * Converts an array of vessels to a Set of VesselIDs for efficient O(1) lookups.
 * Used to quickly check if a vessel is already being animated.
 *
 * @param vessels Array of vessel locations
 * @returns Set of VesselIDs
 */
export const toVesselsSet = (vessels: VesselLocation[]): Set<number> =>
  new Set(vessels.map(vessel => vessel.VesselID));

/**
 * Applies exponential smoothing to vessel positions for fluid map animations.
 *
 * Creates smooth transitions between GPS updates by blending current and previous
 * positions. Uses 93.3% previous position + 6.7% current position for natural
 * movement. Detects teleportation events (route changes, docking) and snaps
 * to new position instead of smoothing.
 *
 * @param animatedVessels Currently smoothed vessel positions
 * @param currentVessels Latest GPS vessel location data
 * @returns Array of smoothly animated vessel positions
 */
export const animateVessels = (
  animatedVessels: VesselLocation[],
  currentVessels: VesselLocation[]
): VesselLocation[] => {
  const currentVesselsRecord = toVesselsRecord(currentVessels);
  return animatedVessels
    .map(smoothedVessel => {
      try {
        const currentVessel = currentVesselsRecord[smoothedVessel.VesselID];

        // Keep existing vessel if no current data available
        if (!currentVessel) {
          return smoothedVessel;
        }

        // Detect teleportation (sudden large position changes)
        if (
          calculateDistance(smoothedVessel, currentVessel) >
          TELEPORT_THRESHOLD_KM
        ) {
          return currentVessel; // Snap to new position
        }

        // Apply exponential smoothing to coordinates and heading
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
          Heading: smoothHeading(smoothedVessel.Heading, currentVessel.Heading),
        };
      } catch (error) {
        console.error("Error animating vessel", {
          vesselId: smoothedVessel.VesselID,
          error: error instanceof Error ? error.message : String(error),
        });
        return undefined;
      }
    })
    .filter((vessel): vessel is VesselLocation => vessel !== undefined);
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
    acc[vessel.VesselID] = vessel;
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
  vp1: VesselLocation,
  vp2: VesselLocation
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
