/**
 * Pipeline stage: derive the active overlay indicator from the selected row.
 */

import { clamp } from "@/shared/utils";
import type {
  ActiveTimelineRow,
  TimelineActiveIndicator,
  TimelinePipelineWithActiveIndicator,
  TimelinePipelineWithRenderRows,
  TimelineRow,
  TimePoint,
} from "../../types";

const ACTIVE_DOCK_MIN_OFFSET = 0.06;
const MOVING_SPEED_THRESHOLD_KNOTS = 0.1;

/**
 * Adds the active overlay indicator to the pipeline context.
 *
 * @param input - Pipeline context containing rows, active row, and render rows
 * @returns Pipeline context enriched with the active indicator
 */
export const toActiveIndicator = (
  input: TimelinePipelineWithRenderRows
): TimelinePipelineWithActiveIndicator => ({
  ...input,
  activeIndicator: getActiveIndicator(input.activeRow, input.item, input.now),
});

/**
 * Builds the active indicator for the selected row.
 *
 * @param activeRow - Selected active row
 * @param item - Vessel trip and telemetry data
 * @param now - Current wall-clock time
 * @returns Active overlay indicator, or `null`
 */
const getActiveIndicator = (
  activeRow: ActiveTimelineRow | null,
  item: TimelinePipelineWithRenderRows["item"],
  now: Date
): TimelineActiveIndicator | null => {
  if (!activeRow) {
    return null;
  }

  return {
    rowId: activeRow.row.rowId,
    positionPercent: getIndicatorPositionPercent(activeRow, item, now),
    label: getMinutesUntil(
      getDisplayTime(activeRow.row.endEvent.timePoint),
      now
    ),
    title: item.vesselLocation.VesselName,
    subtitle: getIndicatorSubtitle(activeRow.row, item),
    animate:
      activeRow.row.kind === "at-sea" &&
      (item.vesselLocation.Speed ?? 0) > MOVING_SPEED_THRESHOLD_KNOTS,
    speedKnots: item.vesselLocation.Speed ?? 0,
  };
};

/**
 * Returns the display/countdown time for a boundary point.
 *
 * @param timePoint - Boundary point with scheduled, actual, and estimated times
 * @returns Actual time when available, otherwise estimated time
 */
const getDisplayTime = (timePoint: TimePoint): Date | undefined =>
  timePoint.actual ?? timePoint.estimated;

/**
 * Returns the best available time for progress calculations.
 *
 * @param timePoint - Boundary point with scheduled, actual, and estimated times
 * @returns Actual, estimated, or scheduled time in that priority order
 */
const getBoundaryTime = (timePoint: TimePoint): Date | undefined =>
  timePoint.actual ?? timePoint.estimated ?? timePoint.scheduled;

/**
 * Calculates time-based progress for one derived row.
 *
 * @param row - Derived timeline row
 * @param now - Current wall-clock time
 * @returns Normalized progress ratio between 0 and 1
 */
const getTimeProgress = (row: TimelineRow, now: Date) => {
  const startTime = getBoundaryTime(row.startEvent.timePoint);
  const endTime = getBoundaryTime(row.endEvent.timePoint);

  if (!startTime || !endTime) {
    return 0;
  }

  const durationMs = endTime.getTime() - startTime.getTime();
  if (durationMs <= 0) {
    return 0;
  }

  const elapsedMs = now.getTime() - startTime.getTime();
  return clamp(elapsedMs / durationMs, 0, 1);
};

/**
 * Calculates distance-based in-transit progress when telemetry is available.
 *
 * @param departingDistance - Distance from the vessel to the departing terminal
 * @param arrivingDistance - Distance from the vessel to the arriving terminal
 * @returns Clamped distance ratio between 0 and 1, or `null`
 */
const getDistanceProgress = (
  departingDistance: number | undefined,
  arrivingDistance: number | undefined
): number | null => {
  if (
    departingDistance === undefined ||
    arrivingDistance === undefined ||
    departingDistance + arrivingDistance <= 0
  ) {
    return null;
  }

  return clamp(
    departingDistance / (departingDistance + arrivingDistance),
    0,
    1
  );
};

/**
 * Calculates active-indicator progress for the owning row.
 *
 * @param activeRow - Selected active row
 * @param item - Vessel trip and telemetry data
 * @param now - Current wall-clock time
 * @returns Row-local indicator position between 0 and 1
 */
const getIndicatorPositionPercent = (
  activeRow: ActiveTimelineRow,
  item: TimelinePipelineWithRenderRows["item"],
  now: Date
) => {
  if (activeRow.isComplete) {
    return 1;
  }

  if (activeRow.row.kind === "at-sea") {
    return (
      getDistanceProgress(
        item.vesselLocation.DepartingDistance,
        item.vesselLocation.ArrivingDistance
      ) ?? getTimeProgress(activeRow.row, now)
    );
  }

  const timeProgress = getTimeProgress(activeRow.row, now);
  return activeRow.rowIndex === 0
    ? Math.max(ACTIVE_DOCK_MIN_OFFSET, timeProgress)
    : timeProgress;
};

/**
 * Produces a short minutes-until label for indicator content.
 *
 * @param targetTime - Target timestamp
 * @param now - Current time
 * @returns Remaining minutes label or `"--"` if no data exists
 */
const getMinutesUntil = (targetTime: Date | undefined, now: Date) => {
  if (targetTime === undefined) {
    return "--";
  }

  const remainingMs = targetTime.getTime() - now.getTime();
  const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60_000));

  return `${remainingMinutes}m`;
};

/**
 * Builds subtitle copy for the active indicator.
 *
 * @param row - Selected active row
 * @param item - Vessel trip and telemetry data
 * @returns Subtitle copy
 */
const getIndicatorSubtitle = (
  row: TimelineRow,
  item: TimelinePipelineWithRenderRows["item"]
) => {
  if (row.kind === "at-dock") {
    return "at dock";
  }

  const speed = item.vesselLocation.Speed ?? 0;
  const arrivingDistance = item.vesselLocation.ArrivingDistance;
  if (arrivingDistance === undefined) {
    return `${speed.toFixed(0)} kn`;
  }

  return `${speed.toFixed(0)} kn · ${arrivingDistance.toFixed(1)} mi`;
};
