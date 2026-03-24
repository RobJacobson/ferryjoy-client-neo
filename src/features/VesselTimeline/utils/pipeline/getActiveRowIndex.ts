/**
 * Active row selection and active-indicator payload for the vessel-day
 * timeline.
 *
 * Chooses which semantic row is “current” and derives indicator position,
 * labels, and motion hints from backend-resolved active state plus live
 * distances/time windows. See
 * `ARCHITECTURE.md` for schedule vs actual precedence in layout vs display.
 */

import type { TimelineActiveIndicator } from "@/components/timeline";
import type {
  VesselTimelineActiveState,
  VesselTimelineLiveState,
} from "@/data/contexts";
import { clamp } from "@/shared/utils";
import type {
  TimelineSemanticRow,
  VesselTimelineLayoutConfig,
  VesselTimelinePolicy,
} from "../../types";
import { getDisplayTime } from "../shared/rowEventTime";

/**
 * Picks the semantic row index that should host the active indicator.
 *
 * Prefers the backend-resolved event-pair match when available. When the
 * backend resolves a terminal-tail fallback, matches the final terminal row by
 * event key. Otherwise, no active row is selected.
 *
 * @param rows - Semantic dock/sea rows for the day
 * @param activeState - Backend-resolved active row state, when available
 * @returns Index into `rows` for the active row
 */
export const getActiveRowIndex = (
  rows: TimelineSemanticRow[],
  activeState: VesselTimelineActiveState | null
) => {
  const matchedRowIndex = findRowMatchIndex(rows, activeState);
  if (matchedRowIndex >= 0) {
    return matchedRowIndex;
  }

  return findTerminalTailMatchIndex(rows, activeState);
};

/**
 * Builds the floating indicator descriptor for the active row, or null.
 *
 * @param rows - Semantic rows (same array passed to layout)
 * @param activeRowIndex - Row index from `getActiveRowIndex`
 * @param activeState - Backend-resolved active row state and copy
 * @param liveState - Compact live vessel state for title, motion, and progress
 * @param now - Wall clock for countdown label and progress
 * @param policy - Compressed dock geometry parameters
 * @param layout - Pixel sizing for compressed dock vertical mapping
 * @returns `TimelineActiveIndicator` or null when the row is missing
 */
export const buildActiveIndicator = ({
  rows,
  activeRowIndex,
  activeState,
  liveState,
  now,
  policy,
  layout,
}: {
  rows: TimelineSemanticRow[];
  activeRowIndex: number;
  activeState: VesselTimelineActiveState | null;
  liveState: VesselTimelineLiveState | null;
  now: Date;
  policy: VesselTimelinePolicy;
  layout: VesselTimelineLayoutConfig;
}): TimelineActiveIndicator | null => {
  const row = rows[activeRowIndex];
  if (!row) {
    return null;
  }

  const positionPercent = getRowPositionPercent(
    row,
    liveState,
    now,
    policy,
    layout
  );

  return {
    rowId: row.id,
    positionPercent,
    label: getMinutesUntil(row.endEvent, now),
    title: liveState?.VesselName,
    subtitle: activeState?.subtitle,
    animate: activeState?.animate ?? false,
    speedKnots: activeState?.speedKnots ?? liveState?.Speed ?? 0,
  };
};

const findRowMatchIndex = (
  rows: TimelineSemanticRow[],
  activeState: VesselTimelineActiveState | null
) => {
  const rowMatch = activeState?.rowMatch;
  if (!rowMatch) {
    return -1;
  }

  return rows.findIndex(
    (row) =>
      row.kind === rowMatch.kind &&
      row.startEvent.Key === rowMatch.startEventKey &&
      row.endEvent.Key === rowMatch.endEventKey
  );
};

/**
 * Finds the terminal-tail row that corresponds to the backend terminal-tail
 * event key.
 *
 * @param rows - Semantic rows in order
 * @param activeState - Backend-resolved active row state, when available
 * @returns Index or -1 when no terminal-tail fallback was supplied
 */
const findTerminalTailMatchIndex = (
  rows: TimelineSemanticRow[],
  activeState: VesselTimelineActiveState | null
) => {
  const terminalTailEventKey = activeState?.terminalTailEventKey;
  if (!terminalTailEventKey) {
    return -1;
  }

  return rows.findIndex(
    (row) =>
      row.isTerminal === true && row.startEvent.Key === terminalTailEventKey
  );
};

/**
 * Fraction along the sea leg from departing vs arriving distance when both
 * exist and sum to a positive value.
 *
 * @param departingDistance - Nautical miles from departure terminal
 * @param arrivingDistance - Nautical miles to arrival terminal
 * @returns Progress 0–1, or null when distances are unusable
 */
const getDistanceProgress = (
  departingDistance: number | undefined,
  arrivingDistance: number | undefined
) => {
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
 * Indicator position along a sea row: distance-based when possible, else
 * time-based progress between row ends.
 *
 * @param row - Active sea semantic row
 * @param liveState - Live distances when available
 * @param now - Wall clock for time fallback
 * @returns Position along the row in 0–1
 */
const getSeaProgress = (
  row: TimelineSemanticRow,
  liveState: VesselTimelineLiveState | null,
  now: Date
) => {
  const distanceProgress = getDistanceProgress(
    liveState?.DepartingDistance,
    liveState?.ArrivingDistance
  );

  return distanceProgress ?? getTimeProgress(row.startEvent, row.endEvent, now);
};

/**
 * Total pixel height for one semantic row including compressed break marker.
 *
 * @param row - Row with display duration and mode
 * @param layout - Pixels per minute and minimum row height
 * @returns Clamped row height in pixels
 */
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

/**
 * Maps the active row to a 0–1 position for the timeline indicator dot.
 *
 * Sea rows use `getSeaProgress`; proportional docks use elapsed time; compressed
 * docks map wall time into stub, break, and departure window bands.
 *
 * @param row - Active semantic row
 * @param liveState - Live state for sea progress
 * @param now - Current instant
 * @param policy - Compressed dock minute bands
 * @param layout - Pixel heights for compressed mapping
 * @returns Vertical position as a fraction of row height
 */
const getRowPositionPercent = (
  row: TimelineSemanticRow,
  liveState: VesselTimelineLiveState | null,
  now: Date,
  policy: VesselTimelinePolicy,
  layout: VesselTimelineLayoutConfig
) => {
  if (row.kind === "sea") {
    return getSeaProgress(row, liveState, now);
  }

  if (row.displayMode !== "compressed-dock-break") {
    return getTimeProgress(row.startEvent, row.endEvent, now);
  }

  const naturalDisplayHeightPx = getDisplayHeightPx(row, layout);
  const offsetPx = getCompressedDockOffsetPx(row, now, policy, layout);

  return clamp(offsetPx / Math.max(1, naturalDisplayHeightPx), 0, 1);
};

/**
 * Linear time progress between two row boundary events using display times.
 *
 * @param startEvent - Row start event
 * @param endEvent - Row end event
 * @param now - Current instant
 * @returns 0–1 clamped fraction through the span
 */
const getTimeProgress = (
  startEvent: TimelineSemanticRow["startEvent"],
  endEvent: TimelineSemanticRow["endEvent"],
  now: Date
) => {
  const startTime = getDisplayTime(startEvent);
  const endTime = getDisplayTime(endEvent);
  if (!startTime || !endTime) {
    return 0;
  }

  const durationMs = endTime.getTime() - startTime.getTime();
  if (durationMs <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(1, (now.getTime() - startTime.getTime()) / durationMs)
  );
};

/**
 * Countdown minutes until the event’s display time for the badge label.
 *
 * @param event - Row end event
 * @param now - Current instant
 * @returns String such as `12m`, or `--` when time is unknown
 */
const getMinutesUntil = (event: TimelineSemanticRow["endEvent"], now: Date) => {
  const targetTime = getDisplayTime(event);
  if (!targetTime) {
    return "--";
  }

  const remainingMinutes = Math.max(
    0,
    Math.ceil((targetTime.getTime() - now.getTime()) / 60_000)
  );

  return `${remainingMinutes}m`;
};

/**
 * Pixel offset from the top of a compressed dock row for the current time.
 *
 * Maps elapsed real minutes into arrival stub height, break band, and departure
 * window height so the indicator moves through the compressed layout.
 *
 * @param row - Dock row in compressed display mode
 * @param now - Current instant
 * @param policy - Stub and window minute lengths
 * @param layout - Pixels per minute and break marker height
 * @returns Y offset in pixels within the row’s display height
 */
const getCompressedDockOffsetPx = (
  row: TimelineSemanticRow,
  now: Date,
  policy: VesselTimelinePolicy,
  layout: VesselTimelineLayoutConfig
) => {
  const startTime = getDisplayTime(row.startEvent);
  const endTime = getDisplayTime(row.endEvent);
  if (!startTime || !endTime) {
    return getDisplayHeightPx(row, layout) / 2;
  }

  const totalMinutes = Math.max(
    1,
    (endTime.getTime() - startTime.getTime()) / 60_000
  );
  const elapsedMinutes = Math.max(
    0,
    Math.min(totalMinutes, (now.getTime() - startTime.getTime()) / 60_000)
  );

  const arrivalHeightPx =
    policy.compressedDockArrivalStubMinutes * layout.pixelsPerMinute;
  const departureHeightPx =
    policy.compressedDockDepartureWindowMinutes * layout.pixelsPerMinute;
  const breakHeightPx = layout.compressedBreakMarkerHeightPx;

  if (elapsedMinutes <= policy.compressedDockArrivalStubMinutes) {
    return (
      (elapsedMinutes / Math.max(1, policy.compressedDockArrivalStubMinutes)) *
      arrivalHeightPx
    );
  }

  if (
    totalMinutes - elapsedMinutes <=
    policy.compressedDockDepartureWindowMinutes
  ) {
    const minutesIntoDepartureWindow =
      policy.compressedDockDepartureWindowMinutes -
      (totalMinutes - elapsedMinutes);

    return (
      arrivalHeightPx +
      breakHeightPx +
      (minutesIntoDepartureWindow /
        Math.max(1, policy.compressedDockDepartureWindowMinutes)) *
        departureHeightPx
    );
  }

  return arrivalHeightPx + breakHeightPx / 2;
};
