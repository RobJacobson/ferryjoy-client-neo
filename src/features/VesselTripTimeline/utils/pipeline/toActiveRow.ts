/**
 * Pipeline stage: resolve the currently active derived row.
 */

import type {
  TimelinePipelineWithActiveRow,
  TimelinePipelineWithRows,
} from "../../types";

/**
 * Adds the active derived row to the pipeline context.
 *
 * @param input - Pipeline context containing derived rows
 * @returns Pipeline context enriched with the active row
 */
export const toActiveRow = (
  input: TimelinePipelineWithRows
): TimelinePipelineWithActiveRow => {
  if (input.rows.length === 0) {
    return {
      ...input,
      activeRow: null,
    };
  }

  const { trip, vesselLocation } = input.item;
  const lastRowIndex = input.rows.length - 1;
  const atSeaRowIndex = input.rows.findIndex((row) => row.kind === "at-sea");
  const isComplete = trip.AtDockDepartNext?.Actual !== undefined;
  const rowIndex = isComplete
    ? lastRowIndex
    : trip.ArriveDest || trip.TripEnd
      ? lastRowIndex
      : trip.LeftDock || vesselLocation.LeftDock
        ? atSeaRowIndex >= 0
          ? atSeaRowIndex
          : Math.min(1, lastRowIndex)
        : 0;

  return {
    ...input,
    activeRow: {
      row: input.rows[rowIndex],
      rowIndex,
      isComplete,
    },
  };
};
