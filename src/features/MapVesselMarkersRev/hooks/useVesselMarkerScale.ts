import type { VesselLocation } from "@/domain";
import { useMapState } from "@/shared/contexts";
import { useMapScale } from "@/shared/hooks/useMapScale";
import { clamp } from "@/shared/utils";
import { mapProjectionUtils } from "@/shared/utils/mapProjection";

// Perspective scaling constant
const PERSPECTIVE_STRENGTH = 1;

/**
 * Calculate perspective scaling factor based on pitch and screen Y position
 * Creates a linear relationship where:
 * - screenY = -1 (bottom of screen, closer to camera) gets larger scale when pitch > 0
 * - screenY = +1 (top of screen, further from camera) gets smaller scale when pitch > 0
 * - screenY = 0 (center of screen) gets scale = 1.0
 *
 * @param pitch - The pitch angle of the map in degrees
 * @param screenY - The normalized screen Y position (-1 to 1)
 * @returns The perspective scaling factor
 */
const calculatePerspectiveScale = (pitch: number, screenY: number): number => {
  // No perspective effect when map is flat
  if (pitch === 0) return 1.0;

  // Use cosine-based adjustment: effect becomes more dramatic as pitch approaches 90°
  const pitchRad = pitch * (Math.PI / 180);
  const pitchEffect = (1 - Math.cos(pitchRad)) * PERSPECTIVE_STRENGTH;

  // Create linear relationship:
  // screenY = -1 → scale > 1.0 (larger)
  // screenY = 0 → scale = 1.0 (normal)
  // screenY = +1 → scale < 1.0 (smaller)
  const perspectiveFactor = 1.0 - screenY * pitchEffect;

  return clamp(perspectiveFactor, 0.5, 2.0);
};

/**
 * Custom hook to calculate the scale factor for a vessel marker
 * Combines zoom-based scaling with perspective scaling based on map pitch and position
 *
 * @param vessel - The vessel location data
 * @returns The calculated scale factor for the marker
 */
export const useVesselMarkerScale = (vessel: VesselLocation) => {
  const { cameraState, mapDimensions } = useMapState();
  const zoomScale = useMapScale();

  // Calculate precise screen Y position using viewport-mercator-project
  const screenY = mapProjectionUtils.getNormalizedScreenY(
    [vessel.Longitude, vessel.Latitude],
    cameraState,
    mapDimensions
  );

  // Calculate perspective scale based on pitch and screen Y position
  const perspectiveScale = calculatePerspectiveScale(
    cameraState.pitch,
    screenY
  );

  // Calculate final marker size by combining both scaling factors
  return perspectiveScale * zoomScale;
};
