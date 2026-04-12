/**
 * Pipeline stage: map derived rows into renderer-facing rows and layout.
 */

import type {
  RowLayoutBounds,
  TerminalCardGeometry,
  TimelineRenderEvent,
  TimelineRenderRow,
} from "@/components/timeline";
import { START_OF_DAY_DOCK_VISUAL_CAP_MINUTES } from "../config";
import type { VesselTimelineLayoutConfig, VesselTimelineRow } from "../types";
import { isCompressedStartDockRow } from "./isCompressedStartDockRow";
import type {
  VesselTimelinePipelineWithActiveRow,
  VesselTimelinePipelineWithRenderRows,
} from "./pipelineTypes";

/**
 * Adds renderer rows, layout bounds, and terminal-card geometry to the
 * VesselTimeline render pipeline.
 *
 * @param input - Pipeline context containing derived rows and active-row state
 * @returns Pipeline context enriched with renderer-facing layout data
 */
export const toRenderRows = (
  input: VesselTimelinePipelineWithActiveRow
): VesselTimelinePipelineWithRenderRows => {
  let contentHeightPx = 0;
  const rowTopPxs: number[] = [];
  const rowLayouts: Record<string, RowLayoutBounds> = {};
  const activeRowIndex = input.activeRow?.rowIndex ?? -1;

  const renderRows = input.rows.map((row, rowIndex) => {
    const displayHeightPx = getDisplayHeightPx(row, rowIndex, input.layout);
    const startEvent = toRenderEvent(
      row,
      "start",
      input.getTerminalNameByAbbrev
    );

    rowTopPxs.push(contentHeightPx);
    rowLayouts[row.rowId] = {
      y: contentHeightPx,
      height: displayHeightPx,
    };
    contentHeightPx += displayHeightPx;

    return {
      id: row.rowId,
      kind: row.kind,
      markerAppearance: rowIndex <= activeRowIndex ? "past" : "future",
      segmentIndex: rowIndex,
      displayHeightPx,
      startLabel: getStartEventLabel(startEvent),
      showStartTimePlaceholder: shouldShowStartTimePlaceholder(
        startEvent,
        rowIndex,
        activeRowIndex
      ),
      terminalHeadline: getTerminalHeadline(startEvent),
      startEvent,
      endEvent: toRenderEvent(row, "end", input.getTerminalNameByAbbrev),
      isFinalRow: row.rowEdge === "terminal-tail",
    } satisfies TimelineRenderRow;
  });

  return {
    ...input,
    renderRows,
    rowLayouts,
    terminalCards: computeTerminalCards(
      input.rows,
      renderRows,
      rowTopPxs,
      input.layout
    ),
    contentHeightPx,
    activeRowIndex,
  };
};

/**
 * Calculates row display height from row duration and feature layout config.
 *
 * @param row - Derived row with schedule-first duration minutes
 * @param layout - Feature layout config
 * @returns Height in pixels for the row
 */
const getDisplayHeightPx = (
  row: VesselTimelineRow,
  rowIndex: number,
  layout: VesselTimelineLayoutConfig
) =>
  Math.max(
    layout.minRowHeightPx,
    layout.rowHeightBasePx +
      layout.rowHeightScalePx *
        Math.max(
          0,
          isCompressedStartDockRow(row, rowIndex)
            ? Math.min(
                row.durationMinutes,
                START_OF_DAY_DOCK_VISUAL_CAP_MINUTES
              )
            : row.durationMinutes
        ) **
          layout.rowHeightExponent
  );

/**
 * Whether to show `--` in the secondary time column when actual and estimated
 * are missing.
 *
 * @param startEvent - Start boundary for the row
 * @param rowIndex - Index in render order
 * @param activeRowIndex - Current active row, or -1 when none
 * @returns True when the UI should reserve placeholder secondary content
 */
const shouldShowStartTimePlaceholder = (
  startEvent: TimelineRenderEvent,
  rowIndex: number,
  activeRowIndex: number
): boolean => {
  if (startEvent.isArrivalPlaceholder === true) {
    return true;
  }
  if (startEvent.timePoint.scheduled !== undefined) {
    return true;
  }
  return (
    activeRowIndex >= 0 &&
    rowIndex < activeRowIndex &&
    startEvent.eventType === "depart" &&
    startEvent.timePoint.actual !== undefined
  );
};

/**
 * Converts one side of a derived row into the shared renderer event shape.
 *
 * @param row - Derived feature row
 * @param side - Row boundary to convert
 * @param getTerminalNameByAbbrev - Terminal-name lookup for display copy
 * @returns Renderer-facing boundary event
 */
const toRenderEvent = (
  row: VesselTimelineRow,
  side: "start" | "end",
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null
): TimelineRenderEvent => {
  const event = side === "start" ? row.startEvent : row.endEvent;

  return {
    eventType:
      side === "start"
        ? row.kind === "at-dock"
          ? "arrive"
          : "depart"
        : row.kind === "at-dock"
          ? "depart"
          : "arrive",
    currTerminalAbbrev: event.TerminalAbbrev,
    currTerminalDisplayName: getDisplayTerminalName(
      event.TerminalAbbrev,
      getTerminalNameByAbbrev
    ),
    nextTerminalAbbrev:
      side === "start" && row.kind === "at-sea"
        ? row.endEvent.TerminalAbbrev
        : undefined,
    isArrivalPlaceholder: event.IsArrivalPlaceholder,
    timePoint: {
      scheduled: event.EventScheduledTime,
      actual: event.EventActualTime,
      estimated: event.EventPredictedTime,
    },
  };
};

/**
 * Builds the compact row-start label used by the shared timeline renderer.
 *
 * @param event - Renderer-facing start event
 * @returns Start label text
 */
const getStartEventLabel = (event: TimelineRenderEvent) =>
  event.eventType === "arrive"
    ? event.currTerminalAbbrev
      ? `Arv: ${event.currTerminalAbbrev}`
      : "Arv"
    : event.nextTerminalAbbrev
      ? `To: ${event.nextTerminalAbbrev}`
      : "Dep";

/**
 * Resolves the optional terminal headline shown above dock rows.
 *
 * @param event - Renderer-facing start event
 * @returns Terminal headline text when applicable
 */
const getTerminalHeadline = (event: TimelineRenderEvent) =>
  event.eventType === "arrive" ? event.currTerminalDisplayName : undefined;

/**
 * Resolves the display terminal name used by the shared renderer.
 *
 * @param terminalAbbrev - Canonical terminal abbreviation
 * @param getTerminalNameByAbbrev - Terminal-name lookup for display copy
 * @returns Display terminal name, or `undefined`
 */
const getDisplayTerminalName = (
  terminalAbbrev: string | undefined,
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null
) => {
  if (!terminalAbbrev) {
    return undefined;
  }

  const terminalName = getTerminalNameByAbbrev(terminalAbbrev);
  if (!terminalName) {
    return terminalAbbrev;
  }

  return terminalName.replace(/Island\b/, "Is.").trim();
};

/**
 * Builds terminal-card geometry for dock rows and their paired sea rows.
 *
 * @param rows - Derived rows in render order
 * @param renderRows - Renderer rows in render order
 * @param rowTopPxs - Row top positions in pixels
 * @param layout - Feature layout config
 * @returns Terminal-card geometry list
 */
const computeTerminalCards = (
  rows: VesselTimelineRow[],
  renderRows: TimelineRenderRow[],
  rowTopPxs: number[],
  layout: VesselTimelineLayoutConfig
): TerminalCardGeometry[] => {
  const terminalCards: TerminalCardGeometry[] = [];

  for (let rowIndex = 0; rowIndex < renderRows.length; rowIndex++) {
    const renderRow = renderRows[rowIndex];
    const row = rows[rowIndex];
    const rowTopPx = rowTopPxs[rowIndex];
    if (!renderRow || !row || rowTopPx === undefined) {
      continue;
    }

    const position = getCardPosition(rows, renderRows, rowIndex);
    if (!position) {
      continue;
    }

    const topPx =
      position === "bottom"
        ? rowTopPx
        : rowTopPx - layout.terminalCardTopHeightPx;
    const heightPx =
      position === "bottom"
        ? layout.terminalCardBottomHeightPx
        : position === "single"
          ? renderRow.displayHeightPx
          : renderRow.displayHeightPx + layout.terminalCardTopHeightPx;

    terminalCards.push({
      id: renderRow.id,
      position,
      topPx,
      heightPx,
    });
  }

  return terminalCards;
};

/**
 * Classifies the terminal-card shape for one row.
 *
 * @param rows - Derived rows in render order
 * @param renderRows - Renderer rows in render order
 * @param rowIndex - Row index to classify
 * @returns Terminal-card position token, or `null`
 */
const getCardPosition = (
  rows: VesselTimelineRow[],
  renderRows: TimelineRenderRow[],
  rowIndex: number
): TerminalCardGeometry["position"] | null => {
  const renderRow = renderRows[rowIndex];
  const row = rows[rowIndex];
  if (!renderRow || !row) {
    return null;
  }

  const terminalAbbrev = row.startEvent.TerminalAbbrev;
  const previousRenderRow = rowIndex > 0 ? renderRows[rowIndex - 1] : undefined;
  const previousRow = rowIndex > 0 ? rows[rowIndex - 1] : undefined;
  const nextRenderRow = renderRows[rowIndex + 1];
  const nextRow = rows[rowIndex + 1];

  const matchesNext =
    renderRow.kind === "at-dock" &&
    nextRenderRow?.kind === "at-sea" &&
    terminalAbbrev !== undefined &&
    terminalAbbrev === nextRow?.startEvent.TerminalAbbrev;

  const matchesPrevious =
    previousRenderRow?.kind === "at-dock" &&
    renderRow.kind === "at-sea" &&
    previousRow?.startEvent.TerminalAbbrev !== undefined &&
    previousRow.startEvent.TerminalAbbrev === terminalAbbrev;

  if (matchesNext) {
    return "top";
  }

  if (matchesPrevious) {
    return "bottom";
  }

  return renderRow.kind === "at-dock" && terminalAbbrev ? "single" : null;
};
