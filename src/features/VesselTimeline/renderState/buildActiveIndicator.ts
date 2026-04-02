/**
 * Active-indicator payload construction for the vessel-day timeline.
 *
 * Derives indicator position, labels, and motion hints from the backend-owned
 * active row plus the raw live vessel state.
 */

import type { VesselTimelineLiveState } from "convex/functions/vesselTimeline/activeStateSchemas";
import type { VesselTimelineRow } from "convex/functions/vesselTimeline/schemas";
import type { TimelineActiveIndicator } from "@/components/timeline";
import { clamp } from "@/shared/utils";
import { getDisplayTime } from "../rowEventTime";

const INDICATOR_ANIMATION_SPEED_THRESHOLD = 0.1;

/**
 * Builds the floating indicator descriptor for the active row, or `null` when
 * the backend does not attach one.
 *
 * @param rows - Backend-owned timeline rows for the day
 * @param activeRowId - Backend-owned active row identifier
 * @param liveState - Raw live vessel state used for subtitle and motion
 * @param now - Wall clock for countdown label and progress
 * @returns Timeline indicator payload, or `null` when no active row is present
 */
export const buildActiveIndicator = ({
  rows,
  activeRowId,
  liveState,
  now,
}: {
  rows: VesselTimelineRow[];
  activeRowId: string | null;
  liveState: VesselTimelineLiveState | null;
  now: Date;
}): TimelineActiveIndicator | null => {
  const row = getActiveRow(rows, activeRowId);
  if (!row) {
    return null;
  }

  return {
    rowId: row.rowId,
    positionPercent: getPositionPercent(row, liveState, now),
    label: getMinutesUntil(row, now),
    title: liveState?.VesselName,
    subtitle: getSubtitle(row, liveState),
    animate: shouldAnimateIndicator(row, liveState),
    speedKnots: liveState?.Speed ?? 0,
  };
};

/**
 * Resolves the active backend row from its row id.
 *
 * @param rows - Backend-owned timeline rows for the day
 * @param activeRowId - Backend-owned active row identifier
 * @returns Selected row, or `null` when unavailable
 */
const getActiveRow = (
  rows: VesselTimelineRow[],
  activeRowId: string | null
) => {
  if (!activeRowId) {
    return null;
  }

  return rows.find((row) => row.rowId === activeRowId) ?? null;
};

/**
 * Fraction along the sea leg from departing vs arriving distance when both
 * exist.
 *
 * @param departingDistance - Nautical miles from departure terminal
 * @param arrivingDistance - Nautical miles to arrival terminal
 * @returns Progress 0–1
 */
const getDistanceProgress = (
  departingDistance: number,
  arrivingDistance: number
) => clamp(departingDistance / (departingDistance + arrivingDistance), 0, 1);

/**
 * Maps the active row to a 0–1 position for the timeline indicator dot.
 *
 * Sea rows use live distance when both distances are present; otherwise they
 * fall back to display-time progress. Dock rows use display-time bounds, but
 * future-start rows are centered to avoid snapping the indicator onto an
 * arrival marker that has not happened yet.
 *
 * @param row - Active backend row
 * @param liveState - Raw live state for sea progress
 * @param now - Current instant
 * @returns Vertical position as a fraction of row height
 */
const getPositionPercent = (
  row: VesselTimelineRow,
  liveState: VesselTimelineLiveState | null,
  now: Date
) =>
  row.kind === "at-sea" &&
  liveState?.DepartingDistance !== undefined &&
  liveState?.ArrivingDistance !== undefined
    ? getDistanceProgress(
        liveState.DepartingDistance,
        liveState.ArrivingDistance
      )
    : row.kind === "at-dock"
      ? getDockPositionPercent(row, now)
      : getTimeProgress(row.startEvent, row.endEvent, now);

/**
 * Positioning for at-dock rows.
 *
 * When the row's arrival edge is still in the future, centering the indicator
 * is less misleading than pinning it to a not-yet-valid arrival marker.
 *
 * @param row - Active at-dock row
 * @param now - Current instant
 * @returns Vertical position as a fraction of row height
 */
const getDockPositionPercent = (row: VesselTimelineRow, now: Date) => {
  const startTime = getDisplayTime(row.startEvent);
  if (!startTime || startTime.getTime() > now.getTime()) {
    return 0.5;
  }

  return getTimeProgress(row.startEvent, row.endEvent, now);
};

/**
 * Linear time progress between two row boundary events using display-time
 * precedence.
 *
 * @param startEvent - Row start event
 * @param endEvent - Row end event
 * @param now - Current instant
 * @returns 0–1 clamped fraction through the span
 */
const getTimeProgress = (
  startEvent: VesselTimelineRow["startEvent"],
  endEvent: VesselTimelineRow["endEvent"],
  now: Date
) =>
  getClampedProgress(getDisplayTime(startEvent), getDisplayTime(endEvent), now);

/**
 * Clamped elapsed progress between two instants.
 *
 * Returns `0` when either instant is missing or when the interval is not
 * positive.
 *
 * @param startTime - Interval start
 * @param endTime - Interval end
 * @param now - Current instant
 * @returns 0–1 clamped progress through the interval
 */
const getClampedProgress = (
  startTime: Date | undefined,
  endTime: Date | undefined,
  now: Date
) => {
  if (!startTime || !endTime) {
    return 0;
  }

  const totalMs = endTime.getTime() - startTime.getTime();
  if (totalMs <= 0) {
    return 0;
  }

  return clamp((now.getTime() - startTime.getTime()) / totalMs, 0, 1);
};

/**
 * Countdown minutes until the row's display end time for the badge label.
 *
 * Terminal-tail rows show `"--"` because the end-of-day stop is not a
 * countdown.
 *
 * @param row - Active backend row
 * @param now - Current instant
 * @returns Countdown string such as `12m`, or `"--"` when time is unknown
 */
const getMinutesUntil = (row: VesselTimelineRow, now: Date) => {
  if (row.rowEdge === "terminal-tail") {
    return "--";
  }

  const targetTime = getDisplayTime(row.endEvent);
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
 * Builds the indicator subtitle from the active row kind and raw live state.
 *
 * @param row - Active backend row
 * @param liveState - Raw live vessel state
 * @returns Subtitle copy, or `undefined` when no useful copy exists
 */
const getSubtitle = (
  row: VesselTimelineRow,
  liveState: VesselTimelineLiveState | null
) =>
  row.kind === "at-dock"
    ? getDockSubtitle(row, liveState)
    : getSeaSubtitle(liveState);

/**
 * Builds the at-dock subtitle.
 *
 * @param row - Active at-dock row
 * @param liveState - Raw live vessel state
 * @returns Dock subtitle, or `undefined`
 */
const getDockSubtitle = (
  row: VesselTimelineRow,
  liveState: VesselTimelineLiveState | null
) => {
  const terminalAbbrev =
    liveState?.DepartingTerminalAbbrev ??
    row.endEvent.TerminalAbbrev ??
    row.startEvent.TerminalAbbrev;

  return terminalAbbrev ? `At dock ${terminalAbbrev}` : undefined;
};

/**
 * Builds the at-sea subtitle.
 *
 * @param liveState - Raw live vessel state
 * @returns Sea subtitle, or `undefined`
 */
const getSeaSubtitle = (liveState: VesselTimelineLiveState | null) => {
  if (!liveState) {
    return undefined;
  }

  const speed = liveState.Speed ?? 0;
  if (liveState.ArrivingDistance === undefined) {
    return `${speed.toFixed(0)} kn`;
  }

  const terminalPart = liveState.ArrivingTerminalAbbrev
    ? ` to ${liveState.ArrivingTerminalAbbrev}`
    : "";

  return `${speed.toFixed(0)} kn · ${liveState.ArrivingDistance.toFixed(
    1
  )} mi${terminalPart}`;
};

/**
 * Determines whether the active indicator should animate.
 *
 * @param row - Active backend row
 * @param liveState - Raw live vessel state
 * @returns Whether rocking animation should run
 */
const shouldAnimateIndicator = (
  row: VesselTimelineRow,
  liveState: VesselTimelineLiveState | null
) =>
  row.kind === "at-sea" &&
  liveState?.InService !== false &&
  liveState?.AtDock !== true &&
  (liveState?.Speed ?? 0) > INDICATOR_ANIMATION_SPEED_THRESHOLD;
