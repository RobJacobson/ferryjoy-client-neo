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

  const rowIndex = rows.findIndex((row) =>
    matchesActiveInterval(row, activeInterval)
  );

  if (rowIndex < 0) {
    return null;
  }

  return {
    row: rows[rowIndex],
    rowIndex,
  };
};

/**
 * Returns whether one derived row corresponds to the backend active interval.
 *
 * @param row - Derived feature row
 * @param activeInterval - Backend active interval
 * @returns Whether the row is the structural interval match
 */
const matchesActiveInterval = (
  row: VesselTimelinePipelineWithRows["rows"][number],
  activeInterval: Exclude<VesselTimelineActiveInterval, null>
) => {
  if (activeInterval.kind === "at-sea") {
    return (
      row.kind === "at-sea" &&
      row.startEvent.Key === activeInterval.startEventKey &&
      row.endEvent.Key === activeInterval.endEventKey
    );
  }

  return (
    row.kind === "at-dock" &&
    (activeInterval.startEventKey === null ||
      row.startEvent.Key === activeInterval.startEventKey) &&
    (activeInterval.endEventKey === null ||
      row.endEvent.Key === activeInterval.endEventKey)
  );
};
