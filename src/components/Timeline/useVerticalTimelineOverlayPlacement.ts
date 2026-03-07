/**
 * Shared hook for measuring vertical timeline layouts and positioning
 * a single absolute overlay indicator.
 *
 * Manages state for:
 * - Row measurements (y position and height by row ID)
 * - Timeline container width
 * - Computed overlay placement based on row progress and axis ratio
 *
 * Returns props for timeline container and rows to enable layout callbacks,
 * plus the computed overlay placement for rendering.
 */

import { useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import type { TimelineRowBounds } from "./TimelineRow";

type VerticalTimelineOverlayIndicator = {
  rowId: string;
  positionPercent: number;
};

/**
 * Manages row/timeline measurements and computes overlay placement.
 *
 * The hook returns:
 * - overlayPlacement: computed {top, left} or undefined while measuring
 * - timelineContainerProps: onLayout callback for width measurement
 * - timelineProps: onRowLayout callback for row measurements
 *
 * @param overlayIndicator - Active overlay indicator with row ID and progress
 * @param axisXRatio - Horizontal anchor ratio in [0, 1], 0.5 for center alignment
 * @returns Placement plus layout props for timeline container and rows
 */
export const useVerticalTimelineOverlayPlacement = (
  overlayIndicator: VerticalTimelineOverlayIndicator,
  axisXRatio: number
): {
  overlayPlacement: { top: number; left: number } | undefined;
  timelineContainerProps: {
    onLayout: (event: LayoutChangeEvent) => void;
  };
  timelineProps: {
    onRowLayout: (rowId: string, bounds: TimelineRowBounds) => void;
  };
} => {
  const [rowLayouts, setRowLayouts] = useState<
    Record<string, TimelineRowBounds>
  >({});
  const [timelineWidth, setTimelineWidth] = useState(0);
  const overlayPlacement = getOverlayPlacement(
    overlayIndicator,
    rowLayouts,
    timelineWidth,
    axisXRatio
  );

  return {
    overlayPlacement,
    timelineContainerProps: {
      onLayout: (event: LayoutChangeEvent) => {
        setTimelineWidth(event.nativeEvent.layout.width);
      },
    },
    timelineProps: {
      onRowLayout: (rowId: string, bounds: TimelineRowBounds) => {
        setRowLayouts((previous) => ({
          ...previous,
          [rowId]: bounds,
        }));
      },
    },
  };
};

/**
 * Computes absolute overlay placement from model and measured layouts.
 *
 * Placement calculation:
 * - top = rowY + rowHeight * positionPercent
 * - left = timelineWidth * axisXRatio
 *
 * Returns undefined if required measurements are incomplete or invalid.
 *
 * @param overlayIndicator - Indicator model with row ID and position percent
 * @param rowLayouts - Measured row layout map keyed by row ID
 * @param timelineWidth - Measured timeline container width in pixels
 * @param axisXRatio - Horizontal anchor ratio in [0, 1], 0.5 for center
 * @returns Absolute placement for overlay center or undefined
 */
const getOverlayPlacement = (
  overlayIndicator: VerticalTimelineOverlayIndicator,
  rowLayouts: Record<string, TimelineRowBounds>,
  timelineWidth: number,
  axisXRatio: number
): { top: number; left: number } | undefined => {
  const rowLayout = rowLayouts[overlayIndicator.rowId];
  if (!rowLayout || rowLayout.height <= 0 || timelineWidth <= 0) {
    return undefined;
  }

  const clampedPercent = clamp01(overlayIndicator.positionPercent);
  const clampedAxisXRatio = clamp01(axisXRatio);

  return {
    top: rowLayout.y + rowLayout.height * clampedPercent,
    left: timelineWidth * clampedAxisXRatio,
  };
};

/**
 * Clamps a number to the inclusive range [0, 1].
 *
 * @param value - Raw ratio
 * @returns Clamped ratio
 */
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
