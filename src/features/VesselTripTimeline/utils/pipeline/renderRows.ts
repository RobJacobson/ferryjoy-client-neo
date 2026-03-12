/**
 * Pipeline stage 4: derive render-ready rows from the document.
 * Output is combined with the active indicator in the renderState stage.
 */

import type {
  TimelineDocument,
  TimelineDocumentRow,
  TimelineLifecyclePhase,
  TimelineRenderBoundary,
  TimelineRenderRow,
} from "../../types";

/**
 * Maps the document to render-ready rows (labels, phase, isFinalRow).
 *
 * @param document - Output from the document stage
 * @returns Render-ready rows for the UI
 */
export const renderRows = (document: TimelineDocument): TimelineRenderRow[] =>
  document.rows.map((row: TimelineDocumentRow, index: number) => {
    const phase = getRowPhase(row.segmentIndex, document.activeSegmentIndex);

    return {
      id: row.id,
      kind: row.kind,
      segmentIndex: row.segmentIndex,
      geometryMinutes: row.geometryMinutes,
      startBoundary: getStartBoundary(row, phase),
      isFinalRow: index === document.rows.length - 1,
    } satisfies TimelineRenderRow;
  });

/**
 * Derives a row lifecycle phase from ordered position and the active cursor.
 *
 * @param rowIndex - Zero-based row index
 * @param activeSegmentIndex - Active row cursor
 * @returns Lifecycle phase for the row
 */
const getRowPhase = (
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

/**
 * Builds the render-ready start boundary for a row.
 *
 * @param row - Canonical document row
 * @param phase - Lifecycle phase used to choose tense
 * @returns Start boundary label and timepoint
 */
const getStartBoundary = (
  row: TimelineDocumentRow,
  phase: TimelineLifecyclePhase
): TimelineRenderBoundary => ({
  label:
    row.kind === "at-dock"
      ? phase === "upcoming"
        ? "Arv"
        : "Arv"
      : phase === "upcoming"
        ? "To"
        : "To",
  terminalAbbrev:
    row.kind === "at-dock"
      ? row.startBoundary.terminalAbbrev
      : row.endBoundary.terminalAbbrev,
  timePoint: row.startBoundary.timePoint,
});
