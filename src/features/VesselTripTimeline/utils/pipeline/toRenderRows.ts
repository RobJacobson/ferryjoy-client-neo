/**
 * Pipeline stage: map derived rows into renderer-facing rows.
 */

import type {
  TimelineEvent,
  TimelinePipelineWithActiveRow,
  TimelinePipelineWithRenderRows,
  TimelineRenderBoundary,
  TimelineRenderRow,
  TimelineRow,
} from "../../types";

/**
 * Adds render-ready rows to the pipeline context.
 *
 * @param input - Pipeline context containing derived rows and active-row state
 * @returns Pipeline context enriched with render rows
 */
export const toRenderRows = (
  input: TimelinePipelineWithActiveRow
): TimelinePipelineWithRenderRows => ({
  ...input,
  renderRows: input.rows.map(
    (row, rowIndex) =>
      ({
        id: row.rowId,
        kind: row.kind,
        markerAppearance:
          input.activeRow && rowIndex <= input.activeRow.rowIndex
            ? "past"
            : "future",
        segmentIndex: rowIndex,
        geometryMinutes: row.geometryMinutes,
        startLabel: getStartLabel(row),
        showStartTimePlaceholder: false,
        terminalHeadline:
          row.kind === "at-dock"
            ? getDisplayTerminalName(
                row.startEvent.terminalAbbrev,
                input.getTerminalNameByAbbrev
              )
            : undefined,
        startBoundary: toRenderBoundary(
          row.startEvent,
          row.kind === "at-sea" ? row.endEvent.terminalAbbrev : undefined,
          input.getTerminalNameByAbbrev
        ),
        endBoundary: toRenderBoundary(
          row.endEvent,
          undefined,
          input.getTerminalNameByAbbrev
        ),
        isFinalRow: rowIndex === input.rows.length - 1,
      }) satisfies TimelineRenderRow
  ),
});

/**
 * Converts one derived event into a renderer boundary shape.
 *
 * @param event - Derived timeline event
 * @param nextTerminalAbbrev - Optional next terminal abbreviation for sea rows
 * @param getTerminalNameByAbbrev - Terminal-name lookup for display copy
 * @returns Renderer boundary object
 */
const toRenderBoundary = (
  event: TimelineEvent,
  nextTerminalAbbrev: string | undefined,
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null
): TimelineRenderBoundary => ({
  eventType: event.eventType,
  currTerminalAbbrev: event.terminalAbbrev,
  currTerminalDisplayName: getDisplayTerminalName(
    event.terminalAbbrev,
    getTerminalNameByAbbrev
  ),
  nextTerminalAbbrev,
  timePoint: event.timePoint,
});

/**
 * Builds the start label shown at the left of one row.
 *
 * @param row - Derived row
 * @returns Start label text
 */
const getStartLabel = (row: TimelineRow) =>
  row.kind === "at-dock"
    ? row.startEvent.terminalAbbrev
      ? `Arv: ${row.startEvent.terminalAbbrev}`
      : "Arv"
    : row.endEvent.terminalAbbrev
      ? `To: ${row.endEvent.terminalAbbrev}`
      : "Dep";

/**
 * Formats a terminal display name for the compact trip timeline.
 *
 * @param terminalAbbrev - Canonical terminal abbreviation
 * @param getTerminalNameByAbbrev - Terminal-name lookup for display copy
 * @returns Compact terminal name, or `undefined`
 */
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
