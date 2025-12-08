/**
 * Configuration for VesselCircleMarkers
 *
 * Defines styling constants for vessel circle markers based on vessel status.
 */

/** Drop shadow configuration for circle markers */
export const CIRCLE_SHADOW = {
  /** Shadow stroke color */
  strokeColor: "#FF0000",
  /** Shadow stroke width */
  strokeWidth: 2,
  /** Shadow stroke opacity */
  strokeOpacity: 1,
  /** Offset shadow down and right for natural drop shadow effect */
  translate: [2, 3] as [number, number],
} as const;

const DEFAULT_STYLES = {
  circleRadius: 18,
  circleStrokeWidth: 2,
  circleBorderWidth: 4,
} as const;

/**
 * Circle styling configuration by vessel status
 *
 * Colors are inspired by VesselMarkerContent:
 * - At-sea: pink-400 (#f472b6) - prominent for active vessels
 * - At-dock: pink-200 (#fbcfe8) - lighter for docked vessels
 * - Out-of-service: white at 25% opacity - muted for inactive vessels
 */
export const CIRCLE_STYLES = {
  atSea: {
    circleColor: "#f472b6", // pink-400
    circleStrokeColor: "#ffffff",
    circleOpacity: 1,
    ...DEFAULT_STYLES,
  },
  atDock: {
    circleColor: "#fbcfe8", // pink-200
    circleStrokeColor: "#ffffff",
    circleOpacity: 1,
    ...DEFAULT_STYLES,
  },
  outOfService: {
    circleColor: "#ffffff",
    circleStrokeColor: "#ffffff",
    circleOpacity: 0.25,
    ...DEFAULT_STYLES,
  },
} as const;

/**
 * Vessel status type for categorization
 */
export type VesselStatus = "outOfService" | "atDock" | "atSea";
