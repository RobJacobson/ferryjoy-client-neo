/**
 * View-state helpers: indicator position, track fill fractions, overlay data.
 */

import { clamp, lerp } from "@/shared/utils";
import { TIMELINE_SHARED_CONFIG } from "./config";
import type { RowLayoutBounds, TimelineActiveIndicator } from "./types";

/**
 * Maps a 0–1 row position to the inset range used for on-screen placement.
 *
 * @param positionPercent - Logical position along the row (0 = top, 1 = bottom)
 * @returns Display position after edge insets
 */
const getDisplayPositionPercent = (positionPercent: number): number =>
  lerp(
    clamp(positionPercent, 0, 1),
    TIMELINE_SHARED_CONFIG.indicatorPositionStartPercent,
    TIMELINE_SHARED_CONFIG.indicatorPositionEndPercent
  );

/**
 * Absolute Y coordinate of the indicator for a laid-out row.
 *
 * @param layout - Measured bounds for the active row
 * @param positionPercent - Position along the row height (0–1)
 * @returns Pixel offset from the timeline container top
 */
export const getIndicatorTopPx = (
  layout: RowLayoutBounds,
  positionPercent: number
): number =>
  layout.y + layout.height * getDisplayPositionPercent(positionPercent);

/**
 * Resolves the active indicator boundary top, or null if unavailable.
 *
 * @param activeIndicator - Current indicator descriptor, if any
 * @param rowLayouts - Row id to measured bounds from `TimelineRowFlex` layouts
 * @returns Pixel top of the indicator, or null when layout is missing
 */
export const getBoundaryTopPx = (
  activeIndicator: TimelineActiveIndicator | null,
  rowLayouts: Record<string, RowLayoutBounds>
): number | null => {
  if (!activeIndicator) {
    return null;
  }

  const layout = rowLayouts[activeIndicator.rowId];
  if (!layout) {
    return null;
  }

  return getIndicatorTopPx(layout, activeIndicator.positionPercent);
};

/**
 * Resolves the completed fraction of the track above the boundary.
 *
 * @param boundaryTopPx - Top of the progress boundary in container coords
 * @param containerHeightPx - Full height of the timeline track container
 * @returns Completed fraction in 0–1
 */
export const getTrackFractions = (
  boundaryTopPx: number | null,
  containerHeightPx: number
): number => {
  if (containerHeightPx <= 0 || boundaryTopPx === null) {
    return 0;
  }

  return clamp(boundaryTopPx / containerHeightPx, 0, 1);
};
