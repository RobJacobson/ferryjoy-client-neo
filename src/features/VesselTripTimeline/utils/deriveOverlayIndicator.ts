/**
 * Pure functions for deriving the active overlay indicator from timeline state.
 */

import { clamp } from "@/shared/utils";
import type { TimelineItem, TimelineRowModel } from "../types";
import { getMinutesUntil } from "./getMinutesUntil";
import { getDisplayTime, getSegmentTimeProgress } from "./timePoints";

export type OverlayIndicator = {
  rowId: string;
  segmentIndex: number;
  positionPercent: number;
  label: string;
};

const getIndicatorLabel = (row: TimelineRowModel, now: Date): string =>
  getMinutesUntil(getDisplayTime(row.endPoint), now);

/**
 * Derives active overlay indicator from timeline rows and trip state.
 * Uses kind + position: first row = at-dock origin, second = at-sea, third =
 * at-dock dest.
 *
 * @param rows - Timeline rows with kind boundaries and labels
 * @param item - Domain item (trip + vesselLocation) for distance-based progress
 * @returns Active overlay indicator model
 */
export const deriveActiveOverlayIndicator = (
  rows: TimelineRowModel[],
  activeSegmentIndex: number,
  item: TimelineItem
): OverlayIndicator => {
  const { vesselLocation } = item;
  const now = new Date();
  const activeRow = getIndicatorRow(rows, activeSegmentIndex);

  if (!activeRow) {
    return {
      rowId: "unknown-row",
      segmentIndex: -1,
      positionPercent: 0,
      label: "--",
    };
  }

  if (activeSegmentIndex >= rows.length) {
    return {
      rowId: activeRow.id,
      segmentIndex: activeRow.segmentIndex,
      positionPercent: 1,
      label: getIndicatorLabel(activeRow, now),
    };
  }

  if (activeSegmentIndex < 0) {
    return {
      rowId: activeRow.id,
      segmentIndex: activeRow.segmentIndex,
      positionPercent: 0,
      label: getIndicatorLabel(activeRow, now),
    };
  }

  if (activeRow.kind === "at-sea" && activeRow.useDistanceProgress) {
    const positionPercent = getDistanceProgress(
      vesselLocation.DepartingDistance,
      vesselLocation.ArrivingDistance
    );

    return {
      rowId: activeRow.id,
      segmentIndex: activeRow.segmentIndex,
      positionPercent,
      label: getIndicatorLabel(activeRow, now),
    };
  }

  const positionPercent =
    activeRow.kind === "at-dock" && activeRow.segmentIndex === 0
      ? Math.max(0.06, getSegmentTimeProgress(activeRow, now))
      : getSegmentTimeProgress(activeRow, now);

  return {
    rowId: activeRow.id,
    segmentIndex: activeRow.segmentIndex,
    positionPercent,
    label: getIndicatorLabel(activeRow, now),
  };
};

/**
 * Resolves which segment should host the overlay indicator.
 *
 * @param rows - Ordered presentation rows
 * @param activeSegmentIndex - Active segment cursor for the ordered list
 * @returns Row that should own the overlay indicator
 */
const getIndicatorRow = (
  rows: TimelineRowModel[],
  activeSegmentIndex: number
): TimelineRowModel | undefined => {
  if (rows.length === 0) {
    return undefined;
  }

  if (activeSegmentIndex < 0) {
    return rows.at(0);
  }

  if (activeSegmentIndex >= rows.length) {
    return rows.at(-1);
  }

  return rows.at(activeSegmentIndex);
};

/**
 * Calculates distance-based in-transit progress when telemetry is available.
 *
 * @param departingDistance - Remaining distance from the departure terminal
 * @param arrivingDistance - Remaining distance to the arrival terminal
 * @returns Clamped distance ratio between 0 and 1
 */
const getDistanceProgress = (
  departingDistance: number | undefined,
  arrivingDistance: number | undefined
): number => {
  if (
    departingDistance === undefined ||
    arrivingDistance === undefined ||
    departingDistance + arrivingDistance <= 0
  ) {
    return 0;
  }

  return clamp(
    departingDistance / (departingDistance + arrivingDistance),
    0,
    1
  );
};
