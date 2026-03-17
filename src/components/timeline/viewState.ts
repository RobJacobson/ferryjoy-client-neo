/**
 * Layout/view-model helpers for the shared vertical timeline renderer.
 */

import { clamp, lerp } from "@/shared/utils";
import { TIMELINE_INDICATOR_POSITION_INSET_PERCENT } from "./config";
import type { RowLayoutBounds, TimelineActiveIndicator } from "./types";

export type OverlayViewState = {
  topPx: number;
  label: string;
};

const getDisplayPositionPercent = (positionPercent: number): number =>
  lerp(
    clamp(positionPercent, 0, 1),
    TIMELINE_INDICATOR_POSITION_INSET_PERCENT,
    1 - TIMELINE_INDICATOR_POSITION_INSET_PERCENT
  );

export const getIndicatorTopPx = (
  layout: RowLayoutBounds,
  positionPercent: number
): number => layout.y + layout.height * getDisplayPositionPercent(positionPercent);

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

export const getOverlayViewState = (
  activeIndicator: TimelineActiveIndicator | null,
  rowLayouts: Record<string, RowLayoutBounds>
): OverlayViewState | null => {
  if (!activeIndicator) {
    return null;
  }

  const topPx = getBoundaryTopPx(activeIndicator, rowLayouts);
  if (topPx === null) {
    return null;
  }

  return {
    topPx,
    label: activeIndicator.label,
  };
};
