/**
 * Layout helpers that convert semantic rows into renderer-ready geometry.
 */

import type {
  TerminalCardGeometry,
  TimelineRenderBoundary,
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
        startBoundary: toRenderBoundary(row.kind, "start", row),
        endBoundary: toRenderBoundary(row.kind, "end", row),
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

const toRenderBoundary = (
  kind: TimelineSemanticRow["kind"],
  side: "start" | "end",
  row: TimelineSemanticRow
): TimelineRenderBoundary => {
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
    timePoint: {
      scheduled: event.ScheduledTime,
      actual: event.ActualTime,
      estimated: event.PredictedTime,
    },
  };
};

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
