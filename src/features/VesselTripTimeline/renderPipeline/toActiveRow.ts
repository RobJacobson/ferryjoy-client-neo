/**
 * Pipeline stage: resolve the currently active derived row.
 */

import { getDestinationArrivalOrCoverageClose } from "@/features/TimelineFeatures/shared/utils";
import type {
  TimelinePipelineWithActiveRow,
  TimelinePipelineWithRows,
} from "../types";

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
  const atDestinationOrClosed = getDestinationArrivalOrCoverageClose(trip);
  const rowIndex = isComplete
    ? lastRowIndex
    : atDestinationOrClosed
      ? lastRowIndex
      : trip.DepartOriginActual || trip.LeftDock || vesselLocation.LeftDock
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
