import type { ReactElement } from "react";

/**
 * Common props for Marker components across platforms
 */
export interface MarkerProps {
  /** The longitude coordinate where marker should be placed */
  longitude: number;

  /** The latitude coordinate where marker should be placed */
  latitude: number;

  /** React elements to be rendered inside marker */
  children: ReactElement;

  /** Optional z-index value to control stacking order of markers */
  zIndex?: number;
}
