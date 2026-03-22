/**
 * Stage 2 layout: semantic vessel-day rows to shared timeline render rows.
 *
 * Assigns pixel heights, past/future markers, `TimelineRenderEvent` payloads,
 * and terminal card highlight geometry consumed by `src/components/timeline`.
 */

import type {
  TerminalCardGeometry,
  TimelineRenderEvent,
  TimelineRenderRow,
} from "@/components/timeline";
import type {
  TimelineSemanticRow,
  VesselTimelineLayoutConfig,
} from "../../types";

type LaidOutRow = {
  row: TimelineRenderRow;
  topPx: number;
  terminalAbbrev?: string;
};

/**
 * Lays out semantic rows into renderer rows, terminal cards, and content
 * height.
 *
 * @param semanticRows - Dock/sea rows from `buildTimelineRows`
 * @param activeRowIndex - Split past vs future marker styling at this index
 * @param layout - Pixels per minute, min height, and card offsets
 * @returns Render rows, terminal card regions, and total scrollable height
 */
export const getLayoutTimelineRows = (
  semanticRows: TimelineSemanticRow[],
  activeRowIndex: number,
  layout: VesselTimelineLayoutConfig
): {
  rows: TimelineRenderRow[];
  terminalCards: TerminalCardGeometry[];
  contentHeightPx: number;
} => {
  let topPx = 0;

  const laidOutRows: LaidOutRow[] = semanticRows.map((row) => {
    const displayHeightPx = getDisplayHeightPx(row, layout);
    const laidOutRow: LaidOutRow = {
      row: {
        id: row.id,
        kind: row.kind === "dock" ? "at-dock" : "at-sea",
        markerAppearance:
          row.segmentIndex <= activeRowIndex ? "past" : "future",
        segmentIndex: row.segmentIndex,
        displayHeightPx,
        startEvent: toRenderEvent(row.kind, "start", row),
        endEvent: toRenderEvent(row.kind, "end", row),
        isFinalRow: row.isTerminal === true,
      },
      topPx,
      terminalAbbrev: row.startEvent.TerminalAbbrev,
    };

    topPx += displayHeightPx;
    return laidOutRow;
  });

  return {
    rows: laidOutRows.map(({ row }) => row),
    terminalCards: computeTerminalCards(laidOutRows, layout),
    contentHeightPx: topPx,
  };
};

/**
 * Row display height from display minutes, optional compressed break marker, and
 * minimum row height.
 *
 * @param row - Semantic row with `displayDurationMinutes` and `displayMode`
 * @param layout - Scale and break marker height
 * @returns Height in pixels for this row
 */
const getDisplayHeightPx = (
  row: TimelineSemanticRow,
  layout: VesselTimelineLayoutConfig
) => {
  const proportionalHeightPx =
    row.displayDurationMinutes * layout.pixelsPerMinute;
  const compressedBreakHeightPx =
    row.displayMode === "compressed-dock-break"
      ? layout.compressedBreakMarkerHeightPx
      : 0;

  return Math.max(
    layout.minRowHeightPx,
    proportionalHeightPx + compressedBreakHeightPx
  );
};

/**
 * Builds a presentation event for one end of a semantic row.
 *
 * @param kind - Dock vs sea determines arrive/depart labeling
 * @param side - Start vs end boundary of the row
 * @param row - Source semantic row
 * @returns `TimelineRenderEvent` for labels, times, and placeholders
 */
const toRenderEvent = (
  kind: TimelineSemanticRow["kind"],
  side: "start" | "end",
  row: TimelineSemanticRow
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
  rows: LaidOutRow[],
  layout: VesselTimelineLayoutConfig
): TerminalCardGeometry[] => {
  const cards: TerminalCardGeometry[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const current = rows[rowIndex];
    if (!current) {
      continue;
    }

    const position = getCardPosition(rows, rowIndex);
    if (position === "none") {
      continue;
    }

    const topPx =
      position === "bottom"
        ? current.topPx
        : current.topPx + layout.terminalCardTopOffsetPx;
    const heightPx =
      position === "bottom"
        ? layout.terminalCardDepartureCapHeightPx
        : position === "single"
          ? current.row.displayHeightPx
          : current.row.displayHeightPx - layout.terminalCardTopOffsetPx;

    cards.push({
      id: current.row.id,
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
  rows: LaidOutRow[],
  rowIndex: number
): TerminalCardGeometry["position"] | "none" => {
  const row = rows[rowIndex];
  if (!row) {
    return "none";
  }

  const previousRow = rowIndex > 0 ? rows[rowIndex - 1] : undefined;
  const nextRow = rows[rowIndex + 1];

  const matchesNext =
    row.row.kind === "at-dock" &&
    nextRow?.row.kind === "at-sea" &&
    row.terminalAbbrev !== undefined &&
    row.terminalAbbrev === nextRow.terminalAbbrev;

  const matchesPrevious =
    previousRow?.row.kind === "at-dock" &&
    row.row.kind === "at-sea" &&
    previousRow.terminalAbbrev !== undefined &&
    previousRow.terminalAbbrev === row.terminalAbbrev;

  if (matchesNext) {
    return "top";
  }

  if (matchesPrevious) {
    return "bottom";
  }

  return row.row.kind === "at-dock" && row.terminalAbbrev ? "single" : "none";
};
