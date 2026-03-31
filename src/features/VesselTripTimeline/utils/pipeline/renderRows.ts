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
export const renderRows = (
  document: TimelineDocument,
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null
): TimelineRenderRow[] =>
  document.rows.map((row: TimelineDocumentRow, index: number) => {
    const markerAppearance =
      getRowPhase(row.segmentIndex, document.activeSegmentIndex) === "upcoming"
        ? "future"
        : "past";

    return {
      id: row.id,
      kind: row.kind,
      markerAppearance,
      segmentIndex: row.segmentIndex,
      geometryMinutes: row.geometryMinutes,
      startLabel: getStartLabel(row),
      showStartTimePlaceholder: false,
      terminalHeadline: getTerminalHeadline(row, getTerminalNameByAbbrev),
      startBoundary: getStartBoundary(row, getTerminalNameByAbbrev),
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
 * @returns Start boundary label and timepoint
 */
const getStartBoundary = (
  row: TimelineDocumentRow,
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null
): TimelineRenderBoundary => ({
  eventType: row.kind === "at-dock" ? "arrive" : "depart",
  currTerminalAbbrev: row.startBoundary.terminalAbbrev,
  currTerminalDisplayName: getDisplayTerminalName(
    row.startBoundary.terminalAbbrev,
    getTerminalNameByAbbrev
  ),
  nextTerminalAbbrev:
    row.kind === "at-sea" ? row.endBoundary.terminalAbbrev : undefined,
  timePoint: row.startBoundary.timePoint,
});

const getStartLabel = (row: TimelineDocumentRow) =>
  row.kind === "at-dock"
    ? row.startBoundary.terminalAbbrev
      ? `Arv: ${row.startBoundary.terminalAbbrev}`
      : "Arv"
    : row.endBoundary.terminalAbbrev
      ? `To: ${row.endBoundary.terminalAbbrev}`
      : "Dep";

const getTerminalHeadline = (
  row: TimelineDocumentRow,
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null
) =>
  row.kind === "at-dock"
    ? getDisplayTerminalName(
        row.startBoundary.terminalAbbrev,
        getTerminalNameByAbbrev
      )
    : undefined;

const getDisplayTerminalName = (
  terminalAbbrev: string | undefined,
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null
) => {
  if (!terminalAbbrev) {
    return undefined;
  }

  const terminalName = getTerminalNameByAbbrev(terminalAbbrev);
  return terminalName
    ?.replace("Island", "Is.")
    .replace("Port", "Pt.")
    .replace("Point", "Pt.");
};
