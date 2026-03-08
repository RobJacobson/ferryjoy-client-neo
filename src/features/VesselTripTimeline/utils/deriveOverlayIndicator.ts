/**
 * Pure functions for deriving the active overlay indicator from timeline state.
 */

import { clamp } from "@/shared/utils";
import type { TimelineItem, TimelineRowModel, TimePoint } from "../types";
import { getMinutesUntil } from "./getMinutesUntil";

export type OverlayIndicator = {
  rowId: string;
  positionPercent: number;
  label: string;
};

/**
 * Computes normalized elapsed progress between start and end timestamps.
 *
 * @param startTime - Start timestamp
 * @param endTime - End timestamp
 * @param now - Current time reference
 * @returns Clamped progress ratio between 0 and 1
 */
const getTimeProgress = (startTime: Date, endTime: Date, now: Date): number => {
  const duration = endTime.getTime() - startTime.getTime();
  if (duration <= 0) return 0;
  const elapsed = now.getTime() - startTime.getTime();
  return clamp(elapsed / duration, 0, 1);
};

const getDisplayTime = (timePoint: TimePoint): Date | undefined =>
  timePoint.actual ?? timePoint.estimated;

const getIndicatorLabel = (row: TimelineRowModel, now: Date): string =>
  getMinutesUntil(getDisplayTime(row.eventTimeEnd), now);

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
  item: TimelineItem
): OverlayIndicator => {
  const { trip, vesselLocation } = item;
  // 3 rows: at-dock (origin), at-sea, at-dock (destination)
  const atDockOrigin = rows.find((r) => r.kind === "at-dock");
  const atSeaRow = rows.find((r) => r.kind === "at-sea");
  const atDockDest = rows.filter((r) => r.kind === "at-dock").pop();
  const now = new Date();

  // If vessel has departed from destination
  if (trip.AtDockDepartNext?.Actual && atDockDest) {
    return {
      rowId: atDockDest.id,
      positionPercent: 1,
      label: getIndicatorLabel(atDockDest, now),
    };
  }

  // If vessel has arrived at destination, show progress toward departure
  if (trip.TripEnd && atDockDest) {
    return {
      rowId: atDockDest.id,
      positionPercent: getTimeProgress(
        atDockDest.startTime,
        atDockDest.endTime,
        now
      ),
      label: getIndicatorLabel(atDockDest, now),
    };
  }

  // If vessel hasn't departed yet, show progress at dock (origin)
  if (!trip.LeftDock && atDockOrigin) {
    return {
      rowId: atDockOrigin.id,
      positionPercent: Math.max(
        0.06,
        getTimeProgress(atDockOrigin.startTime, atDockOrigin.endTime, now)
      ),
      label: getIndicatorLabel(atDockOrigin, now),
    };
  }

  // If vessel is at sea, show in-transit progress (distance-based when available)
  if (atSeaRow) {
    let positionPercent: number;
    if (
      atSeaRow.useDistanceProgress &&
      vesselLocation.DepartingDistance !== undefined &&
      vesselLocation.ArrivingDistance !== undefined &&
      vesselLocation.DepartingDistance + vesselLocation.ArrivingDistance > 0
    ) {
      positionPercent =
        vesselLocation.DepartingDistance /
        (vesselLocation.DepartingDistance + vesselLocation.ArrivingDistance);
      positionPercent = clamp(positionPercent, 0, 1);
    } else {
      positionPercent = getTimeProgress(
        atSeaRow.startTime,
        atSeaRow.endTime,
        now
      );
    }
    return {
      rowId: atSeaRow.id,
      positionPercent,
      label: getIndicatorLabel(atSeaRow, now),
    };
  }

  const fallbackRow = rows[0];
  return {
    rowId: fallbackRow?.id ?? "unknown-row",
    positionPercent: 0,
    label: fallbackRow ? getIndicatorLabel(fallbackRow, now) : "--",
  };
};
