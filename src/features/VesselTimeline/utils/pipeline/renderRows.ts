/**
 * Pipeline stage 4: derive render-ready rows with deterministic pixel geometry.
 */

import { getTerminalNameByAbbrev } from "@/data/terminalLocations";
import type {
  VesselTimelineDocument,
  VesselTimelineLayoutConfig,
  VesselTimelineRenderRow,
} from "../../types";

/**
 * Converts canonical rows into render-ready rows with explicit top offsets and
 * pixel heights.
 *
 * @param document - Canonical vessel timeline document
 * @param layout - Layout config used to convert display minutes into pixels
 * @returns Render-ready rows with explicit geometry
 */
export const renderRows = (
  document: VesselTimelineDocument,
  layout: VesselTimelineLayoutConfig
): VesselTimelineRenderRow[] => {
  let topPx = 0;

  return document.rows.map((row) => {
    const displayHeightPx = Math.max(
      layout.minRowHeightPx,
      row.displayDurationMinutes * layout.pixelsPerMinute
    );
    const renderRow: VesselTimelineRenderRow = {
      id: row.id,
      kind: row.kind,
      markerAppearance:
        row.segmentIndex <= document.activeSegmentIndex ? "past" : "future",
      isTerminal: row.isTerminal,
      startBoundary: {
        eventType: row.kind === "dock" ? "arrive" : "depart",
        currTerminalAbbrev: row.startBoundary.terminalAbbrev,
        currTerminalDisplayName: getDisplayTerminalName(
          row.startBoundary.terminalAbbrev
        ),
        nextTerminalAbbrev:
          row.kind === "sea" ? row.endBoundary.terminalAbbrev : undefined,
        timePoint: row.startBoundary.timePoint,
      },
      endBoundary: {
        eventType: row.kind === "dock" ? "depart" : "arrive",
        currTerminalAbbrev: row.endBoundary.terminalAbbrev,
        currTerminalDisplayName: getDisplayTerminalName(
          row.endBoundary.terminalAbbrev
        ),
        timePoint: row.endBoundary.timePoint,
      },
      displayHeightPx,
      topPx,
      displayMode: row.displayMode,
      segmentIndex: row.segmentIndex,
    };

    topPx += displayHeightPx;
    return renderRow;
  });
};

const getDisplayTerminalName = (terminalAbbrev?: string) => {
  if (!terminalAbbrev) {
    return undefined;
  }

  const terminalName = getTerminalNameByAbbrev(terminalAbbrev);
  return terminalName
    ?.replace("Island", "Is.")
    .replace("Port", "Pt.")
    .replace("Point", "Pt.");
};
