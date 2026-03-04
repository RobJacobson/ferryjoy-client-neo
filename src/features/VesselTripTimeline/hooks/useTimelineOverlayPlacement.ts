/**
 * Hook for vessel timeline overlay measurement and placement.
 */

import { useState } from "react";
import type { LayoutChangeEvent } from "react-native";

type RowLayout = {
  rowY: number;
  rowHeight: number;
};

type OverlayIndicatorPlacement = {
  rowId: string;
  positionPercent: number;
};

/**
 * Manages row/timeline measurements and computes overlay placement.
 *
 * @param overlayIndicator - Active overlay indicator with row and progress
 * @param axisXRatio - Horizontal anchor ratio in [0, 1]
 * @returns Placement plus layout props for timeline container and rows
 */
export const useTimelineOverlayPlacement = (
  overlayIndicator: OverlayIndicatorPlacement,
  axisXRatio: number
): {
  overlayPlacement: { top: number; left: number } | undefined;
  timelineContainerProps: {
    onLayout: (event: LayoutChangeEvent) => void;
  };
  timelineProps: {
    onRowLayout: (rowId: string, bounds: { y: number; height: number }) => void;
  };
} => {
  const [rowLayouts, setRowLayouts] = useState<Record<string, RowLayout>>({});
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
      onRowLayout: (rowId: string, bounds: { y: number; height: number }) => {
        setRowLayouts((previous) => ({
          ...previous,
          [rowId]: {
            rowY: bounds.y,
            rowHeight: bounds.height,
          },
        }));
      },
    },
  };
};

/**
 * Computes absolute overlay placement from model and measured layouts.
 *
 * @param overlayIndicator - Indicator model with row and progress
 * @param rowLayouts - Measured row layout map
 * @param timelineWidth - Measured timeline container width
 * @param axisXRatio - Horizontal anchor ratio in [0, 1]
 * @returns Absolute placement for overlay center
 */
const getOverlayPlacement = (
  overlayIndicator: OverlayIndicatorPlacement,
  rowLayouts: Record<string, RowLayout>,
  timelineWidth: number,
  axisXRatio: number
): { top: number; left: number } | undefined => {
  const rowLayout = rowLayouts[overlayIndicator.rowId];
  if (!rowLayout || rowLayout.rowHeight <= 0 || timelineWidth <= 0) {
    return undefined;
  }

  const clampedPercent = clamp01(overlayIndicator.positionPercent);
  const clampedAxisXRatio = clamp01(axisXRatio);

  return {
    top: rowLayout.rowY + rowLayout.rowHeight * clampedPercent,
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
