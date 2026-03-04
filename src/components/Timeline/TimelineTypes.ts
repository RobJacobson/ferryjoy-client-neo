/**
 * Shared types for Timeline primitives.
 * These types are intentionally domain-agnostic and UI-focused.
 */

import type { ReactNode } from "react";

/** Supported orientations for timeline layout. */
export type TimelineOrientation = "vertical" | "horizontal";

/**
 * One timeline row/segment.
 * Time range is Date-only by design.
 */
export type TimelineRow = {
  id: string;
  startTime: Date;
  endTime: Date;
  percentComplete: number;
  leftContent?: ReactNode;
  rightContent?: ReactNode;
  markerContent?: ReactNode;
  indicatorContent?: ReactNode;
  minHeight?: number;
};

/** Styling and layout options shared by timeline primitives. */
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
