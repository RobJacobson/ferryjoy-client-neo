/**
 * Configuration constants for TimelineMeter components.
 * Defines styling constants used across progress bars, markers, and indicators.
 * These values ensure consistent visual hierarchy and cross-platform compatibility (iOS/Android/Web).
 */

/**
 * Shadow style configuration for circles and progress bars.
 * Provides consistent shadow styling across iOS, Android, and Web platforms.
 */
export const shadowStyle = {
  // iOS shadows
  shadowColor: "#000",
  shadowOffset: { width: -2, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 3,
  // Android elevation
  elevation: 2,
  // Web box-shadow (React Native Web supports this directly)
  // Converts shadow properties: rgba(0,0,0,0.2) 0px 1px 2px
  boxShadow: "-1px 1px 2px rgba(0, 0, 0, 0.15)",
} as const;
