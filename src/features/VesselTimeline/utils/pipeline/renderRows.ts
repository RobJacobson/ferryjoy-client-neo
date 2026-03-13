/**
 * Pipeline stage 4: derive render-ready rows with deterministic pixel geometry.
 */

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
      startBoundary: {
        label: row.kind === "dock" ? "Arv" : "Dep",
        terminalAbbrev: row.startBoundary.terminalAbbrev,
        timePoint: row.startBoundary.timePoint,
      },
      endBoundary: {
        label: row.kind === "dock" ? "Dep" : "Arv",
        terminalAbbrev: row.endBoundary.terminalAbbrev,
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
