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
import type { TimelineSemanticRow } from "../../types";
import { getDisplayTime, getLayoutTime } from "../shared/rowEventTime";

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
 * @returns `TimelineActiveIndicator` or null when the row is missing
 */
export const buildActiveIndicator = ({
  rows,
  activeRowIndex,
  activeState,
  liveState,
  now,
}: {
  rows: TimelineSemanticRow[];
  activeRowIndex: number;
  activeState: VesselTimelineActiveState | null;
  liveState: VesselTimelineLiveState | null;
  now: Date;
}): TimelineActiveIndicator | null => {
  const row = rows[activeRowIndex];
  if (!row) {
    return null;
  }

  const positionPercent = getRowPositionPercent(row, liveState, now);

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
 * Indicator position along a sea row from live distance when available, with an
 * ETA-over-actual-departure fallback when distances are unavailable.
 *
 * @param row - Active sea semantic row
 * @param liveState - Live distances when available
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

  if (distanceProgress !== null) {
    return distanceProgress;
  }

  return getEtaFallbackProgress(row, liveState, now);
};

/**
 * Sea fallback progress from actual departure to live ETA when distance data is
 * unavailable.
 *
 * @param row - Active sea semantic row
 * @param liveState - Live state carrying `Eta` and optional `LeftDock`
 * @param now - Current instant
 * @returns 0–1 progress or `0` when the fallback inputs are unusable
 */
const getEtaFallbackProgress = (
  row: TimelineSemanticRow,
  liveState: VesselTimelineLiveState | null,
  now: Date
) => {
  const departureTime = row.startEvent.ActualTime ?? liveState?.LeftDock;
  const etaTime = liveState?.Eta;

  if (!departureTime || !etaTime) {
    return 0;
  }

  const totalMs = etaTime.getTime() - departureTime.getTime();
  if (totalMs <= 0) {
    return 0;
  }

  return clamp((now.getTime() - departureTime.getTime()) / totalMs, 0, 1);
};

/**
 * Maps the active row to a 0–1 position for the timeline indicator dot.
 *
 * Sea rows use `getSeaProgress`; dock rows use schedule-first elapsed time so
 * the indicator stays aligned with schedule-sized rows as live ETA data drifts.
 *
 * @param row - Active semantic row
 * @param liveState - Live state for sea progress
 * @param now - Current instant
 * @returns Vertical position as a fraction of row height
 */
const getRowPositionPercent = (
  row: TimelineSemanticRow,
  liveState: VesselTimelineLiveState | null,
  now: Date
) => {
  if (row.kind === "sea") {
    return getSeaProgress(row, liveState, now);
  }

  return getTimeProgress(row.startEvent, row.endEvent, now, getLayoutTime);
};

/**
 * Linear time progress between two row boundary events using the supplied
 * event-time selector.
 *
 * @param startEvent - Row start event
 * @param endEvent - Row end event
 * @param now - Current instant
 * @param getEventTime - Function that selects the timeline instant for an event
 * @returns 0–1 clamped fraction through the span
 */
const getTimeProgress = (
  startEvent: TimelineSemanticRow["startEvent"],
  endEvent: TimelineSemanticRow["endEvent"],
  now: Date,
  getEventTime = getDisplayTime
) => {
  const startTime = getEventTime(startEvent);
  const endTime = getEventTime(endEvent);
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
