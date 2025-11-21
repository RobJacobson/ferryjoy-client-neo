/**
 * Native marker component for vessel markers
 *
 * This component provides a native implementation of vessel markers by wrapping
 * the MapboxRN.MarkerView component. It abstracts platform differences and provides
 * a consistent interface for rendering markers on native platforms (iOS/Android).
 * This component should only contain platform-specific code for native implementations.
 */

import MapboxRN from "@rnmapbox/maps";
import type { MarkerProps } from "./types";

/**
 * Native marker component that wraps MapboxRN.MarkerView
 *
 * This component provides a native-specific implementation of vessel markers by wrapping
 * the MapboxRN.MarkerView component. It handles the positioning, anchoring, and
 * overlap behavior of markers on the map for native platforms (iOS/Android).
 *
 * @param longitude - The longitude coordinate where marker should be placed
 * @param latitude - The latitude coordinate where marker should be placed
 * @param children - React elements to be rendered inside the marker
 * @param zIndex - Optional z-index value to control stacking order of markers
 *
 * @returns A MapboxRN.MarkerView component positioned at the specified coordinates
 */
export const Marker = ({
  longitude,
  latitude,
  children,
  zIndex = 1,
}: MarkerProps) => {
  return (
    <MapboxRN.MarkerView
      coordinate={[longitude, latitude]}
      anchor={{ x: 0.5, y: 0.5 }}
      allowOverlap={true}
      style={{ zIndex }}
    >
      {children}
    </MapboxRN.MarkerView>
  );
};
