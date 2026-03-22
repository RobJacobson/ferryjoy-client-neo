/**
 * View-state helpers: indicator position, track fill fractions, overlay data.
 */

import { clamp, lerp } from "@/shared/utils";
import { TIMELINE_INDICATOR_POSITION_INSET_PERCENT } from "./config";
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
    TIMELINE_INDICATOR_POSITION_INSET_PERCENT,
    1 - TIMELINE_INDICATOR_POSITION_INSET_PERCENT
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
 * @param rowLayouts - Row id to measured bounds from `TimelineRow` layouts
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
 * Splits track height into completed (above boundary) and remaining portions.
 *
 * @param boundaryTopPx - Top of the progress boundary in container coords
 * @param containerHeightPx - Full height of the timeline track container
 * @returns Fractions in 0–1 for completed and remaining segments
 */
export const getTrackFractions = (
  boundaryTopPx: number | null,
  containerHeightPx: number
): { completedPercent: number; remainingPercent: number } => {
  if (containerHeightPx <= 0 || boundaryTopPx === null) {
    return { completedPercent: 0, remainingPercent: 1 };
  }

  const completedPercent = clamp(boundaryTopPx / containerHeightPx, 0, 1);

  return {
    completedPercent,
    remainingPercent: 1 - completedPercent,
  };
};
