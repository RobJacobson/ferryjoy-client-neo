/**
 * Shared types for Timeline primitives.
 *
 * These types are intentionally domain-agnostic and UI-focused. Feature-level
 * code (e.g., VesselTripTimeline) maps domain data into these models.
 */

import type { ReactNode } from "react";

/** Supported orientations for timeline layout. */
export type TimelineOrientation = "vertical" | "horizontal";

/**
 * One timeline row/segment.
 *
 * Duration is layout-only geometry and intentionally domain-agnostic.
 * Content slots allow feature-level components to render cards or labels.
 *
 * The minHeight property is an optional per-row override that takes precedence
 * over the theme's minSegmentPx default, useful for exceptional rows that need
 * different minimum heights (e.g., set to 0 for rows that should not consume
 * visual space when not yet applicable).
 */
export type TimelineRow = {
  id: string;
  durationMinutes: number;
  leftContent?: ReactNode;
  rightContent?: ReactNode;
  markerContent?: ReactNode;
  minHeight?: number;
};

/**
 * Theme input type with optional overrides.
 *
 * Theme properties:
 * - minSegmentPx: Global default minimum height/width for timeline segments
 *   (per-row minHeight override takes precedence when set)
 * - centerAxisSizePx: Width of the center axis column (vertical) or row (horizontal)
 * - trackThicknessPx: Thickness of the timeline track line
 * - markerSizePx: Diameter of the static marker dot at segment start
 * - indicatorSizePx: Diameter of the moving indicator dot
 * - *ClassName: NativeWind classes for visual styling of each element
 */
export type TimelineTheme = {
  minSegmentPx?: number;
  centerAxisSizePx?: number;
  trackThicknessPx?: number;
  markerSizePx?: number;
  indicatorSizePx?: number;
  completeTrackClassName?: string;
  upcomingTrackClassName?: string;
  markerClassName?: string;
  indicatorClassName?: string;
};

/** Theme type with all required properties (internal use). */
export type RequiredTimelineTheme = {
  minSegmentPx: number;
  centerAxisSizePx: number;
  trackThicknessPx: number;
  markerSizePx: number;
  indicatorSizePx: number;
  completeTrackClassName: string;
  upcomingTrackClassName: string;
  markerClassName: string;
  indicatorClassName: string;
};

/** Default timeline theme used when props do not override values. */
export const DEFAULT_TIMELINE_THEME: RequiredTimelineTheme = {
  minSegmentPx: 80,
  centerAxisSizePx: 56,
  trackThicknessPx: 8,
  markerSizePx: 18,
  indicatorSizePx: 34,
  completeTrackClassName: "bg-primary",
  upcomingTrackClassName: "bg-primary/20",
  markerClassName: "border border-primary bg-background",
  indicatorClassName: "border border-primary bg-primary/10",
};
