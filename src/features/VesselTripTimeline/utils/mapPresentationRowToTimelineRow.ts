/**
 * Pure functions for mapping presentation rows to timeline row data.
 */
import { clamp } from "@/shared/utils";
import type { TimelineRowModel } from "../types";
import type { OverlayIndicator } from "./deriveOverlayIndicator";

/**
 * Calculates global percent complete for a row based on active indicator row.
 * Rows before the indicator row are 100% complete. Rows after are 0% complete.
 * The indicator's row shows progress based on position percent.
 *
 * @param row - Timeline row to calculate percent for
 * @param overlayIndicator - Active overlay indicator with row and position
 * @returns Percent complete from 0 to 1
 */
export const getGlobalPercentComplete = (
  row: TimelineRowModel,
  overlayIndicator: OverlayIndicator
): number => {
  const delta = overlayIndicator.segmentIndex - row.segmentIndex;
  return delta === 0 ? overlayIndicator.positionPercent : clamp(delta, 0, 1);
};
