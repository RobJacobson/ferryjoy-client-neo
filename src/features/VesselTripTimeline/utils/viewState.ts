/**
 * Layout/view-model helpers for the VesselTripTimeline renderer.
 *
 * This module intentionally stays separate from the core pipeline stages:
 * it combines render-state model data with measured layout bounds to produce
 * render-ready values for the UI layer (e.g. absolute indicator positions,
 * track completion fractions).
 */

import { clamp } from "@/shared/utils";
import type { RowLayoutBounds, TimelineActiveIndicator } from "../types";

export type OverlayViewState = {
  topPx: number;
  shouldJump: boolean;
  label: string;
};

/**
 * Converts row-local progress into an absolute container-relative Y position.
 *
 * @param layout - Measured y and height for the active timeline row
 * @param positionPercent - Row-local progress between 0 and 1
 * @returns Container-relative top position in pixels
 */
export const getIndicatorTopPx = (
  layout: RowLayoutBounds,
  positionPercent: number
): number => layout.y + layout.height * clamp(positionPercent, 0, 1);

/**
 * Returns the absolute boundary top position for the active indicator.
 *
 * @param activeIndicator - Active indicator model (row id + position)
 * @param rowLayouts - Measured bounds keyed by row id
 * @returns Container-relative boundary top position in pixels, or null when
 *          the active indicator or its layout is not yet available
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
 * Derives completed/remaining flex fractions for the full-height track bars.
 *
 * @param boundaryTopPx - Container-relative boundary top position in pixels
 * @param containerHeightPx - Total height of the timeline container in pixels
 * @returns Completed and remaining fractions between 0 and 1
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

/**
 * Builds overlay view-state for the active indicator when layout is ready.
 *
 * @param activeIndicator - Active indicator model
 * @param rowLayouts - Measured bounds keyed by row id
 * @returns Overlay view-state or null when the indicator cannot be positioned
 */
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
