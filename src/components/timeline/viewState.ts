/**
 * Layout/view-model helpers for the shared vertical timeline renderer.
 */

import { clamp } from "@/shared/utils";
import type { RowLayoutBounds, TimelineActiveIndicator } from "./types";

export type OverlayViewState = {
  topPx: number;
  shouldJump: boolean;
  label: string;
};

export const getIndicatorTopPx = (
  layout: RowLayoutBounds,
  positionPercent: number
): number => layout.y + layout.height * clamp(positionPercent, 0, 1);

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

  const layout = rowLayouts[activeIndicator.rowId];
  if (!layout) {
    return null;
  }

  const topPx = getIndicatorTopPx(layout, activeIndicator.positionPercent);

  return {
    topPx,
    shouldJump:
      activeIndicator.positionPercent === 0 ||
      activeIndicator.positionPercent === 1,
    label: activeIndicator.label,
  };
};
