/**
 * Pipeline stage 3: add active-segment cursor to rows to form the document.
 * Output is the input for renderRows and renderState stages.
 */

import type {
  TimelineDocument,
  TimelineDocumentRow,
  TimelineItem,
} from "../../types";

/**
 * Builds the canonical timeline document from rows and item.
 *
 * @param rowsWithGeometry - Output from the rows stage
 * @param item - Vessel trip and location pair (for active-segment logic)
 * @returns TimelineDocument for render stages
 */
export const getDocument = (
  rowsWithGeometry: TimelineDocumentRow[],
  item: TimelineItem
): TimelineDocument => ({
  rows: rowsWithGeometry,
  activeSegmentIndex: getActiveSegmentIndex(item, rowsWithGeometry.length),
});

/**
 * Resolves the active row cursor from current trip state.
 *
 * @param item - Vessel trip and location pair
 * @param rowCount - Number of ordered rows
 * @returns Active row index, or rowCount when the timeline is complete
 */
const getActiveSegmentIndex = (
  item: TimelineItem,
  rowCount: number
): number => {
  const { trip } = item;

  if (trip.AtDockDepartNext?.Actual) {
    return rowCount;
  }

  if (trip.ArriveDest) {
    return Math.max(0, rowCount - 1);
  }

  if (trip.TripEnd) {
    return Math.max(0, rowCount - 1);
  }

  if (trip.LeftDock) {
    return 1;
  }

  return 0;
};
