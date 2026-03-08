/**
 * Pure functions for mapping presentation rows to timeline row data.
 */

import type { TimelineRowModel } from "../types";
import type { OverlayIndicator } from "./deriveOverlayIndicator";

/**
 * Calculates global percent complete for a row based on active indicator row.
 * Rows before the indicator row are 100% complete. Rows after are 0% complete.
 * The indicator's row shows progress based on position percent.
 *
 * @param row - Timeline row to calculate percent for
 * @param presentationRows - All timeline rows
 * @param overlayIndicator - Active overlay indicator with row and position
 * @returns Percent complete from 0 to 1
 */
export const getGlobalPercentComplete = (
  row: TimelineRowModel,
  presentationRows: TimelineRowModel[],
  overlayIndicator: OverlayIndicator
): number => {
  const rowIndex = presentationRows.findIndex((r) => r.id === row.id);
  const indicatorRowIndex = presentationRows.findIndex(
    (r) => r.id === overlayIndicator.rowId
  );

  if (indicatorRowIndex === -1) {
    return row.percentComplete;
  }

  if (rowIndex < indicatorRowIndex) {
    return 1;
  }

  if (rowIndex > indicatorRowIndex) {
    return 0;
  }

  return overlayIndicator.positionPercent;
};
