/**
 * Stage 2 layout: backend-owned VesselTimeline rows to shared render rows.
 *
 * Assigns pixel heights, past/future markers, display labels, and terminal
 * card geometry consumed by `src/components/timeline`.
 */

import type { VesselTimelineRow } from "convex/functions/vesselTimeline/schemas";
import type {
  RowLayoutBounds,
  TerminalCardGeometry,
  TimelineRenderEvent,
  TimelineRenderRow,
} from "@/components/timeline";
import type { VesselTimelineLayoutConfig } from "../types";

/**
 * Lays out backend-owned rows into renderer rows, terminal cards, and content
 * height.
 *
 * @param backendRows - Ordered backend rows for the current vessel/day
 * @param activeRowIndex - Split past vs future marker styling at this index
 * @param layout - Pixels per minute, min height, and card offsets
 * @param getTerminalNameByAbbrev - Terminal-name lookup for display copy
 * @returns Render rows, row layouts, terminal cards, and content height
 */
export const getLayoutTimelineRows = (
  backendRows: VesselTimelineRow[],
  activeRowIndex: number,
  layout: VesselTimelineLayoutConfig,
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null
): {
  rows: TimelineRenderRow[];
  rowLayouts: Record<string, RowLayoutBounds>;
  terminalCards: TerminalCardGeometry[];
  contentHeightPx: number;
} => {
  let contentHeightPx = 0;
  const rowTopPxs: number[] = [];
  const rowLayouts: Record<string, RowLayoutBounds> = {};

  const rows = backendRows.map((row, rowIndex) => {
    const displayHeightPx = getDisplayHeightPx(row, layout);
    const startEvent = toRenderEvent(row, "start", getTerminalNameByAbbrev);
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
      showStartTimePlaceholder: startEvent.isArrivalPlaceholder === true,
      terminalHeadline: getTerminalHeadline(startEvent),
      startEvent,
      endEvent: toRenderEvent(row, "end", getTerminalNameByAbbrev),
      isFinalRow: row.rowEdge === "terminal-tail",
    } satisfies TimelineRenderRow;
  });

  return {
    rows,
    rowLayouts,
    terminalCards: computeTerminalCards(backendRows, rows, rowTopPxs, layout),
    contentHeightPx,
  };
};

/**
 * Row display height from schedule-based minutes and a minimum row height.
 *
 * @param row - Backend row with a schedule-based duration
 * @param layout - Nonlinear row-height tuning and min-height floor
 * @returns Height in pixels for this row
 */
const getDisplayHeightPx = (
  row: VesselTimelineRow,
  layout: VesselTimelineLayoutConfig
) =>
  Math.max(
    layout.minRowHeightPx,
    layout.rowHeightBasePx +
      layout.rowHeightScalePx *
        Math.max(0, row.durationMinutes) ** layout.rowHeightExponent
  );

/**
 * Builds a presentation event for one end of a backend-owned row.
 *
 * @param row - Backend row being rendered
 * @param side - Start vs end boundary of the row
 * @param getTerminalNameByAbbrev - Terminal-name lookup for display copy
 * @returns Timeline render event for labels, times, and placeholders
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
 * Precomputes the left-column row label for the shared timeline renderer.
 *
 * @param event - Start-of-row render event
 * @returns Arrive/depart display label
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
 * Optional terminal heading shown above at-dock rows.
 *
 * @param event - Start-of-row render event
 * @returns Terminal headline text when the row starts at a dock
 */
const getTerminalHeadline = (event: TimelineRenderEvent) =>
  event.eventType === "arrive" ? event.currTerminalDisplayName : undefined;

/**
 * Collects blurred terminal-card regions for dock rows and their paired sea
 * rows at the same terminal.
 *
 * @param backendRows - Backend rows in render order
 * @param rows - Shared renderer rows in render order
 * @param rowTopPxs - Row top positions in pixels
 * @param layout - Card top and bottom heights
 * @returns Geometry entries for `TimelineTerminalCardBackgrounds`
 */
const computeTerminalCards = (
  backendRows: VesselTimelineRow[],
  rows: TimelineRenderRow[],
  rowTopPxs: number[],
  layout: VesselTimelineLayoutConfig
): TerminalCardGeometry[] => {
  const cards: TerminalCardGeometry[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const current = rows[rowIndex];
    const backendRow = backendRows[rowIndex];
    const rowTopPx = rowTopPxs[rowIndex];
    if (!current || !backendRow || rowTopPx === undefined) {
      continue;
    }

    const position = getCardPosition(backendRows, rows, rowIndex);
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
          ? current.displayHeightPx
          : current.displayHeightPx + layout.terminalCardTopHeightPx;

    cards.push({
      id: current.id,
      position,
      topPx,
      heightPx,
    });
  }

  return cards;
};

/**
 * Terminal highlight shape for one row: top cap, bottom cap, full single dock,
 * or none.
 *
 * @param backendRows - Backend rows in render order
 * @param rows - Shared renderer rows in render order
 * @param rowIndex - Index of the row being classified
 * @returns Card position token, or `null` when no highlight applies
 */
const getCardPosition = (
  backendRows: VesselTimelineRow[],
  rows: TimelineRenderRow[],
  rowIndex: number
): TerminalCardGeometry["position"] | null => {
  const row = rows[rowIndex];
  const backendRow = backendRows[rowIndex];
  if (!row || !backendRow) {
    return null;
  }

  const terminalAbbrev = backendRow.startEvent.TerminalAbbrev;
  const previousRow = rowIndex > 0 ? rows[rowIndex - 1] : undefined;
  const previousBackendRow =
    rowIndex > 0 ? backendRows[rowIndex - 1] : undefined;
  const nextRow = rows[rowIndex + 1];
  const nextBackendRow = backendRows[rowIndex + 1];

  const matchesNext =
    row.kind === "at-dock" &&
    nextRow?.kind === "at-sea" &&
    terminalAbbrev !== undefined &&
    terminalAbbrev === nextBackendRow?.startEvent.TerminalAbbrev;

  const matchesPrevious =
    previousRow?.kind === "at-dock" &&
    row.kind === "at-sea" &&
    previousBackendRow?.startEvent.TerminalAbbrev !== undefined &&
    previousBackendRow.startEvent.TerminalAbbrev === terminalAbbrev;

  if (matchesNext) {
    return "top";
  }

  if (matchesPrevious) {
    return "bottom";
  }

  return row.kind === "at-dock" && terminalAbbrev ? "single" : null;
};

/**
 * Returns the shortened terminal name used in the VesselTimeline UI.
 *
 * @param terminalAbbrev - Terminal abbreviation from the backend row
 * @param getTerminalNameByAbbrev - Terminal-name lookup for display copy
 * @returns Short display terminal name, or the abbreviation as fallback
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
