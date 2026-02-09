/**
 * Configuration constants for TimelineMeter components.
 * Defines styling constants used across progress bars, markers, and indicators.
 * These values ensure consistent visual hierarchy and cross-platform compatibility (iOS/Android/Web).
 */

import { cn } from "@/lib/utils";

/** Tailwind class names for timeline accent color (use with cn() for styling). */
export const colors = {
  border: "border-pink-500",
  text: "text-pink-500",
  progress: "bg-pink-300",
  background: "bg-pink-100",
} as const;

/** Timeline marker layout and styling (circle size, container height, content width, default circle class). */
export const timelineMarkerConfig = {
  /** Size in pixels for timeline circle markers. */
  circleSize: 20,
  /** Height in pixels of the timeline marker container (anchor + circle row). */
  containerHeight: 32,
  /** Width in pixels reserved for marker label/time content. */
  contentWidth: 200,
  /** Tailwind classes for timeline marker circle (background + border). */
  markerClass: cn("bg-white border", colors.border),
} as const;

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
