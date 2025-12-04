/**
 * Shared types for Marker components
 */

/**
 * Common props for Marker components across platforms
 */
export interface MarkerProps {
  /** The longitude coordinate where the marker should be placed */
  longitude: number;

  /** The latitude coordinate where the marker should be placed */
  latitude: number;

  /** React elements to be rendered inside the marker */
  children: React.ReactElement;

  /** Optional z-index value to control stacking order of markers */
  zIndex?: number;

  /** Callback when marker is pressed */
  onPress?: () => void;
}
