/**
 * Selector helpers for timeline document and row phase.
 *
 * Operates on the generic document/row types from ./types.
 */

import type {
  TimelineDocument,
  TimelineDocumentRow,
  TimelineLifecyclePhase,
} from "./types";

/**
 * Resolves the row that currently owns the active indicator.
 *
 * @param document - Canonical ordered timeline document
 * @returns Active row, or undefined when the document has no rows
 */
export const getActiveTimelineRow = <TRow extends TimelineDocumentRow>(
  document: TimelineDocument<TRow>
): TRow | undefined => {
  const { rows, activeSegmentIndex } = document;

  if (rows.length === 0) {
    return undefined;
  }

  if (activeSegmentIndex < 0) {
    return rows.at(0);
  }

  if (activeSegmentIndex >= rows.length) {
    return rows.at(-1);
  }

  return rows.at(activeSegmentIndex);
};

/**
 * Derives a row lifecycle phase from ordered position and the active cursor.
 *
 * @param rowIndex - Zero-based row index
 * @param activeSegmentIndex - Active row cursor
 * @returns Lifecycle phase for the row
 */
export const getTimelineRowPhase = (
  rowIndex: number,
  activeSegmentIndex: number
): TimelineLifecyclePhase => {
  if (activeSegmentIndex < 0) {
    return "upcoming";
  }

  if (rowIndex < activeSegmentIndex) {
    return "completed";
  }

  if (rowIndex === activeSegmentIndex) {
    return "active";
  }

  return "upcoming";
};
