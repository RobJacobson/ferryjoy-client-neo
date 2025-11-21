/**
 * Web marker component for vessel markers
 *
 * This component provides a web-specific implementation of vessel markers by wrapping
 * the react-map-gl Marker component. It abstracts platform differences and provides
 * a consistent interface for rendering markers on web platforms. This component
 * should only contain platform-specific code for web implementations.
 */

import { Marker as MapboxMarker } from "react-map-gl/mapbox";
import type { MarkerProps } from "./types";

/**
 * Web marker component that wraps react-map-gl Marker
 *
 * This component provides a web-specific implementation of vessel markers by wrapping
 * the react-map-gl Marker component. It handles the positioning and anchoring of
 * markers on the map for web platforms.
 *
 * @param longitude - The longitude coordinate where marker should be placed
 * @param latitude - The latitude coordinate where marker should be placed
 * @param children - React elements to be rendered inside the marker
 * @param zIndex - Optional z-index value to control stacking order of markers
 *
 * @returns A MapboxMarker component positioned at the specified coordinates
 */
export const Marker = ({
  longitude,
  latitude,
  children,
  zIndex,
}: MarkerProps) => {
  return (
    <MapboxMarker
      longitude={longitude}
      latitude={latitude}
      anchor="center"
      style={{ zIndex }}
    >
      {children}
    </MapboxMarker>
  );
};
