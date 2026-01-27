/**
 * Configuration constants for TripProgressMeter components.
 * Defines sizing, layering, and styling constants used across progress bars, markers, and indicators.
 * These values ensure consistent visual hierarchy and cross-platform compatibility (iOS/Android/Web).
 */

/**
 * Size of the circle indicator in pixels.
 */
export const CIRCLE_SIZE = 20;

/**
 * Height of the progress bar in pixels (matches h-3 = 12px).
 */
export const PROGRESS_BAR_HEIGHT = 12;

/**
 * Z-order / stacking levels for all TripProgress components.
 *
 * Lower numbers render behind higher numbers. On Android, we also map this to
 * `elevation` to ensure consistent stacking.
 */
export const STACKING = {
  bar: 10,
  marker: 20,
  progressCircle: 30,
  activeBar: 40,
} as const;

/**
 * Shadow style configuration for circles and progress bars.
 * Provides consistent shadow styling across iOS, Android, and Web platforms.
 */
export const shadowStyle = {
  // iOS shadows
  shadowColor: "#000",
  shadowOffset: { width: -1, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 2,
  // Android elevation
  elevation: 2,
  // Web box-shadow (React Native Web supports this directly)
  // Converts shadow properties: rgba(0,0,0,0.2) 0px 1px 2px
  boxShadow: "-1px 1px 2px rgba(0, 0, 0, 0.1)",
} as const;
