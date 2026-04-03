/**
 * Pipeline stage: resolve the active derived row from the backend interval.
 */

import type { VesselTimelineActiveInterval } from "convex/functions/vesselTimeline/schemas";
import type {
  VesselTimelineActiveRow,
  VesselTimelinePipelineWithActiveRow,
  VesselTimelinePipelineWithRows,
} from "./pipelineTypes";

/**
 * Adds the selected active row to the VesselTimeline render pipeline.
 *
 * @param input - Pipeline context containing derived rows and active interval
 * @returns Pipeline context enriched with the active row
 */
export const toActiveRow = (
  input: VesselTimelinePipelineWithRows
): VesselTimelinePipelineWithActiveRow => ({
  ...input,
  activeRow: resolveActiveRow(input.rows, input.activeInterval),
});

/**
 * Maps the backend-owned active interval to the local derived-row projection.
 *
 * @param rows - Derived feature rows
 * @param activeInterval - Backend-owned active interval
 * @returns Active derived row, or `null` when no match exists
 */
const resolveActiveRow = (
  rows: VesselTimelinePipelineWithRows["rows"],
  activeInterval: VesselTimelineActiveInterval
): VesselTimelineActiveRow | null => {
  if (!activeInterval) {
    return null;
  }

  const rowIndex = rows.findIndex((row) => {
    if (activeInterval.kind === "at-sea") {
      return (
        row.kind === "at-sea" &&
        row.startEvent.Key === activeInterval.startEventKey &&
        row.endEvent.Key === activeInterval.endEventKey
      );
    }

    if (activeInterval.endEventKey === null) {
      return (
        row.kind === "at-dock" &&
        row.rowEdge === "terminal-tail" &&
        row.startEvent.Key === activeInterval.startEventKey
      );
    }

    return (
      row.kind === "at-dock" &&
      row.rowEdge === "normal" &&
      row.endEvent.Key === activeInterval.endEventKey
    );
  });

  if (rowIndex < 0) {
    return null;
  }

  return {
    row: rows[rowIndex],
    rowIndex,
  };
};
