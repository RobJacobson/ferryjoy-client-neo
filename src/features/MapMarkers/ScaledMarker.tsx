/**
 * Generic ScaledMarker component for map markers
 * Handles zoom-based scaling, perspective scaling, and 3D transforms
 * Children are responsible for visual appearance and styling
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { useMapState } from "@/shared/contexts";
import { useZoomScale } from "@/shared/hooks/useZoomScale";
import { clamp } from "@/shared/utils";
import { mapProjectionUtils } from "@/shared/utils/mapProjection";

// Perspective scaling constant
const PERSPECTIVE_STRENGTH = 1.25;

/**
 * A marker component that scales based on zoom level and perspective.
 *
 * @param children - The visual content of the marker
 * @param latitude - The latitude coordinate of the marker
 * @param longitude - The longitude coordinate of the marker
 * @param className - Optional CSS class name for styling
 * @returns A scaled marker component with appropriate transforms applied
 */
export const ScaledMarker = ({
  children,
  latitude,
  longitude,
  className,
}: {
  children: ReactNode;
  latitude: number;
  longitude: number;
  className?: string;
}) => {
  const { cameraState, mapDimensions } = useMapState();

  // Calculate precise screen Y position using viewport-mercator-project
  const screenY = mapProjectionUtils.getNormalizedScreenY(
    [longitude, latitude],
    cameraState,
    mapDimensions
  );

  // Calculate perspective scale based on pitch and screen Y position
  const perspectiveScale = calculatePerspectiveScale(
    cameraState.pitch,
    screenY
  );

  // Calculate zoom-based scale (1.0 at zoom 10)
  const zoomScale = useZoomScale();

  // Calculate final marker size by combining both scaling factors
  const totalScale = perspectiveScale * zoomScale;

  return (
    <View
      className={className}
      style={{
        transform: [
          { rotateX: `${cameraState.pitch}deg` },
          { scale: totalScale },
        ],
      }}
    >
      {children}
    </View>
  );
};

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

  return clamp(perspectiveFactor, 0.1, 10.0);
};
