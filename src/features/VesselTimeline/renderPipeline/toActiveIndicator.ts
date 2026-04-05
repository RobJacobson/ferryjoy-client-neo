/**
 * Pipeline stage: derive the active indicator from the selected render row.
 */

import type { VesselLocation } from "@/types";
import type { TimelineActiveIndicator } from "@/components/timeline";
import { clamp } from "@/shared/utils";
import { getDisplayTime } from "../rowEventTime";
import type { VesselTimelineRow } from "../types";
import { isCompressedStartDockRow } from "./isCompressedStartDockRow";
import type {
  VesselTimelineActiveRow,
  VesselTimelinePipelineWithActiveIndicator,
  VesselTimelinePipelineWithRenderRows,
} from "./pipelineTypes";

const INDICATOR_ANIMATION_SPEED_THRESHOLD = 0.1;

/**
 * Adds the active indicator overlay payload to the VesselTimeline pipeline.
 *
 * @param input - Pipeline context containing active-row state and vessel data
 * @returns Pipeline context enriched with the active indicator
 */
export const toActiveIndicator = (
  input: VesselTimelinePipelineWithRenderRows
): VesselTimelinePipelineWithActiveIndicator => ({
  ...input,
  activeIndicator: getActiveIndicator(
    input.activeRow,
    input.vesselLocation,
    input.now
  ),
});

/**
 * Builds the active indicator payload for the selected row.
 *
 * @param activeRow - Selected active row
 * @param vesselLocation - Raw live vessel location
 * @param now - Current wall-clock time
 * @returns Indicator payload, or `null` when no row is active
 */
const getActiveIndicator = (
  activeRow: VesselTimelineActiveRow | null,
  vesselLocation: VesselLocation | null,
  now: Date
): TimelineActiveIndicator | null => {
  if (!activeRow) {
    return null;
  }

  const row = activeRow.row;

  return {
    rowId: row.rowId,
    positionPercent: getPositionPercent(activeRow, vesselLocation, now),
    label: getMinutesUntil(row, now),
    title: vesselLocation?.VesselName,
    subtitle: getSubtitle(row, vesselLocation),
    animate: shouldAnimateIndicator(row, vesselLocation),
    speedKnots: vesselLocation?.Speed ?? 0,
  };
};

/**
 * Calculates in-transit progress from live distance telemetry.
 *
 * @param departingDistance - Distance from the vessel to the departing terminal
 * @param arrivingDistance - Distance from the vessel to the arriving terminal
 * @returns Clamped distance ratio between 0 and 1
 */
const getDistanceProgress = (
  departingDistance: number,
  arrivingDistance: number
) => clamp(departingDistance / (departingDistance + arrivingDistance), 0, 1);

/**
 * Maps the active row to a row-local indicator position.
 *
 * @param row - Selected active row
 * @param vesselLocation - Raw live vessel location
 * @param now - Current wall-clock time
 * @returns Position percent within the owning row
 */
const getPositionPercent = (
  activeRow: VesselTimelineActiveRow,
  vesselLocation: VesselLocation | null,
  now: Date
) => {
  const row = activeRow.row;

  if (isCompressedStartDockRow(row, activeRow.rowIndex)) {
    return getCompressedStartDockPositionPercent(row, now);
  }

  return row.kind === "at-sea" &&
    vesselLocation?.DepartingDistance !== undefined &&
    vesselLocation?.ArrivingDistance !== undefined
    ? getDistanceProgress(
        vesselLocation.DepartingDistance,
        vesselLocation.ArrivingDistance
      )
    : row.kind === "at-dock"
      ? getDockPositionPercent(row, now)
      : getTimeProgress(row.startEvent, row.endEvent, now);
};

/**
 * Calculates eased progress for the compressed overnight dock row.
 *
 * @param row - Start-of-day dock row anchored by a real arrival
 * @param now - Current wall-clock time
 * @returns Smoothly eased progress through the compressed visual row
 */
const getCompressedStartDockPositionPercent = (
  row: VesselTimelineRow,
  now: Date
) => easeInSine(getTimeProgress(row.startEvent, row.endEvent, now));

/**
 * Calculates row-local progress for at-dock rows.
 *
 * @param row - Active dock row
 * @param now - Current wall-clock time
 * @returns Position percent within the dock row
 */
const getDockPositionPercent = (row: VesselTimelineRow, now: Date) => {
  if (row.rowEdge === "terminal-tail") {
    return 0;
  }

  const startTime = getDisplayTime(row.startEvent);
  if (!startTime || startTime.getTime() > now.getTime()) {
    return 0.5;
  }

  return getTimeProgress(row.startEvent, row.endEvent, now);
};

/**
 * Calculates time-based progress between the row boundaries.
 *
 * @param startEvent - Row start event
 * @param endEvent - Row end event
 * @param now - Current wall-clock time
 * @returns Clamped progress between 0 and 1
 */
const getTimeProgress = (
  startEvent: VesselTimelineRow["startEvent"],
  endEvent: VesselTimelineRow["endEvent"],
  now: Date
) =>
  getClampedProgress(getDisplayTime(startEvent), getDisplayTime(endEvent), now);

/**
 * Calculates clamped elapsed progress between two instants.
 *
 * @param startTime - Interval start time
 * @param endTime - Interval end time
 * @param now - Current wall-clock time
 * @returns Clamped progress between 0 and 1
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
 * Standard easing curve that starts slowly and approaches departure smoothly.
 *
 * @param progress - Clamped real interval progress
 * @returns Eased visual progress
 */
const easeInSine = (progress: number) =>
  1 - Math.cos((Math.PI / 2) * clamp(progress, 0, 1));

/**
 * Produces the countdown label shown in the active indicator badge.
 *
 * @param row - Selected active row
 * @param now - Current wall-clock time
 * @returns Countdown label such as `12m`, or `"--"`
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
 * Builds the subtitle copy shown under the vessel name.
 *
 * @param row - Selected active row
 * @param vesselLocation - Raw live vessel location
 * @returns Subtitle copy, or `undefined`
 */
const getSubtitle = (
  row: VesselTimelineRow,
  vesselLocation: VesselLocation | null
) =>
  row.kind === "at-dock"
    ? getDockSubtitle(row, vesselLocation)
    : getSeaSubtitle(vesselLocation);

/**
 * Builds dock-state subtitle copy.
 *
 * @param row - Selected dock row
 * @param vesselLocation - Raw live vessel location
 * @returns Dock subtitle, or `undefined`
 */
const getDockSubtitle = (
  row: VesselTimelineRow,
  vesselLocation: VesselLocation | null
) => {
  const terminalAbbrev =
    vesselLocation?.DepartingTerminalAbbrev ??
    row.endEvent.TerminalAbbrev ??
    row.startEvent.TerminalAbbrev;

  return terminalAbbrev ? `At dock ${terminalAbbrev}` : undefined;
};

/**
 * Builds at-sea subtitle copy.
 *
 * @param vesselLocation - Raw live vessel location
 * @returns Sea subtitle, or `undefined`
 */
const getSeaSubtitle = (vesselLocation: VesselLocation | null) => {
  if (!vesselLocation) {
    return undefined;
  }

  const speed = vesselLocation.Speed ?? 0;
  if (vesselLocation.ArrivingDistance === undefined) {
    return `${speed.toFixed(0)} kn`;
  }

  const terminalPart = vesselLocation.ArrivingTerminalAbbrev
    ? ` to ${vesselLocation.ArrivingTerminalAbbrev}`
    : "";

  return `${speed.toFixed(0)} kn · ${vesselLocation.ArrivingDistance.toFixed(
    1
  )} mi${terminalPart}`;
};

/**
 * Determines whether the active indicator should animate.
 *
 * @param row - Selected active row
 * @param vesselLocation - Raw live vessel location
 * @returns Whether indicator animation should run
 */
const shouldAnimateIndicator = (
  row: VesselTimelineRow,
  vesselLocation: VesselLocation | null
) =>
  row.kind === "at-sea" &&
  vesselLocation?.InService !== false &&
  vesselLocation?.AtDock !== true &&
  (vesselLocation?.Speed ?? 0) > INDICATOR_ANIMATION_SPEED_THRESHOLD;
