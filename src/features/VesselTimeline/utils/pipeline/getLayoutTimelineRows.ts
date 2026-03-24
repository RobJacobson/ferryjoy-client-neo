/**
 * Stage 2 layout: semantic vessel-day rows to shared timeline render rows.
 *
 * Assigns pixel heights, past/future markers, `TimelineRenderEvent` payloads,
 * and terminal card highlight geometry consumed by `src/components/timeline`.
 */

import type {
  RowLayoutBounds,
  TerminalCardGeometry,
  TimelineRenderEvent,
  TimelineRenderRow,
} from "@/components/timeline";
import type { VesselTimelineSegment } from "@/data/contexts";
import type { VesselTimelineLayoutConfig } from "../../types";

/**
 * Lays out semantic rows into renderer rows, terminal cards, and content
 * height.
 *
 * @param semanticRows - Server-owned dock/sea semantic segments
 * @param activeRowIndex - Split past vs future marker styling at this index
 * @param layout - Pixels per minute, min height, and card offsets
 * @returns Render rows, terminal card regions, and total scrollable height
 */
export const getLayoutTimelineRows = (
  semanticRows: VesselTimelineSegment[],
  activeRowIndex: number,
  layout: VesselTimelineLayoutConfig
): {
  rows: TimelineRenderRow[];
  rowLayouts: Record<string, RowLayoutBounds>;
  terminalCards: TerminalCardGeometry[];
  contentHeightPx: number;
} => {
  let contentHeightPx = 0;
  const rowTopPxs: number[] = [];
  const rowLayouts: Record<string, RowLayoutBounds> = {};

  const rows = semanticRows.map((row) => {
    const displayHeightPx = getDisplayHeightPx(row, layout);
    rowTopPxs.push(contentHeightPx);
    rowLayouts[row.id] = {
      y: contentHeightPx,
      height: displayHeightPx,
    };
    contentHeightPx += displayHeightPx;

    return {
      id: row.id,
      kind: row.kind === "dock" ? "at-dock" : "at-sea",
      markerAppearance: row.segmentIndex <= activeRowIndex ? "past" : "future",
      segmentIndex: row.segmentIndex,
      displayHeightPx,
      startEvent: toRenderEvent(row.kind, "start", row),
      endEvent: toRenderEvent(row.kind, "end", row),
      isFinalRow: row.isTerminal === true,
    } satisfies TimelineRenderRow;
  });

  return {
    rows,
    rowLayouts,
    terminalCards: computeTerminalCards(semanticRows, rows, rowTopPxs, layout),
    contentHeightPx,
  };
};

/**
 * Row display height from schedule-based minutes and a minimum row height.
 *
 * @param row - Semantic row with a schedule-based duration
 * @param layout - Pixels-per-minute scale and min-height floor
 * @returns Height in pixels for this row
 */
const getDisplayHeightPx = (
  row: VesselTimelineSegment,
  layout: VesselTimelineLayoutConfig
) =>
  Math.max(layout.minRowHeightPx, row.durationMinutes * layout.pixelsPerMinute);

/**
 * Builds a presentation event for one end of a semantic row.
 *
 * @param kind - Dock vs sea determines arrive/depart labeling
 * @param side - Start vs end boundary of the row
 * @param row - Source semantic row
 * @returns `TimelineRenderEvent` for labels, times, and placeholders
 */
const toRenderEvent = (
  kind: VesselTimelineSegment["kind"],
  side: "start" | "end",
  row: VesselTimelineSegment
): TimelineRenderEvent => {
  const event = side === "start" ? row.startEvent : row.endEvent;

  return {
    eventType:
      side === "start"
        ? kind === "dock"
          ? "arrive"
          : "depart"
        : kind === "dock"
          ? "depart"
          : "arrive",
    currTerminalAbbrev: event.TerminalAbbrev,
    currTerminalDisplayName: event.TerminalDisplayName,
    nextTerminalAbbrev:
      side === "start" && kind === "sea"
        ? row.endEvent.TerminalAbbrev
        : undefined,
    isArrivalPlaceholder: event.IsArrivalPlaceholder,
    timePoint: {
      scheduled: event.ScheduledTime,
      actual: event.ActualTime,
      estimated: event.PredictedTime,
    },
  };
};

/**
 * Collects blurred terminal card regions for consecutive dock/sea pairs at
 * the same terminal.
 *
 * @param rows - Laid-out rows with pixel tops
 * @param layout - Card top offset and cap heights
 * @returns Geometry entries for `TimelineTerminalCardBackgrounds`
 */
const computeTerminalCards = (
  semanticRows: VesselTimelineSegment[],
  rows: TimelineRenderRow[],
  rowTopPxs: number[],
  layout: VesselTimelineLayoutConfig
): TerminalCardGeometry[] => {
  const cards: TerminalCardGeometry[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const current = rows[rowIndex];
    const semanticRow = semanticRows[rowIndex];
    const rowTopPx = rowTopPxs[rowIndex];
    if (!current || !semanticRow || rowTopPx === undefined) {
      continue;
    }

    const position = getCardPosition(semanticRows, rows, rowIndex);
    if (!position) {
      continue;
    }

    const topPx =
      position === "bottom"
        ? rowTopPx
        : rowTopPx + layout.terminalCardTopOffsetPx;
    const heightPx =
      position === "bottom"
        ? layout.terminalCardDepartureCapHeightPx
        : position === "single"
          ? current.displayHeightPx
          : current.displayHeightPx - layout.terminalCardTopOffsetPx;

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
 * @param rows - All laid-out rows
 * @param rowIndex - Index of the row being classified
 * @returns Card position token, or `none` when no highlight applies
 */
const getCardPosition = (
  semanticRows: VesselTimelineSegment[],
  rows: TimelineRenderRow[],
  rowIndex: number
): TerminalCardGeometry["position"] | null => {
  const row = rows[rowIndex];
  const semanticRow = semanticRows[rowIndex];
  if (!row || !semanticRow) {
    return null;
  }

  const terminalAbbrev = semanticRow.startEvent.TerminalAbbrev;
  const previousRow = rowIndex > 0 ? rows[rowIndex - 1] : undefined;
  const previousSemanticRow =
    rowIndex > 0 ? semanticRows[rowIndex - 1] : undefined;
  const nextRow = rows[rowIndex + 1];
  const nextSemanticRow = semanticRows[rowIndex + 1];

  const matchesNext =
    row.kind === "at-dock" &&
    nextRow?.kind === "at-sea" &&
    terminalAbbrev !== undefined &&
    terminalAbbrev === nextSemanticRow?.startEvent.TerminalAbbrev;

  const matchesPrevious =
    previousRow?.kind === "at-dock" &&
    row.kind === "at-sea" &&
    previousSemanticRow?.startEvent.TerminalAbbrev !== undefined &&
    previousSemanticRow.startEvent.TerminalAbbrev === terminalAbbrev;

  if (matchesNext) {
    return "top";
  }

  if (matchesPrevious) {
    return "bottom";
  }

  return row.kind === "at-dock" && terminalAbbrev ? "single" : null;
};
