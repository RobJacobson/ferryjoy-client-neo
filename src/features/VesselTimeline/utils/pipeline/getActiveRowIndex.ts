/**
 * Active indicator helpers for the VesselTimeline view model.
 */

import type { TimelineActiveIndicator } from "@/components/timeline";
import type { VesselLocation } from "@/data/contexts";
import { clamp } from "@/shared/utils";
import type {
  TimelineSemanticRow,
  VesselTimelineLayoutConfig,
  VesselTimelinePolicy,
} from "../../types";
import { getDisplayTime } from "./timePrecedence";

const MOVING_SPEED_THRESHOLD_KNOTS = 0.1;

export const getActiveRowIndex = (
  rows: TimelineSemanticRow[],
  _vesselLocation: VesselLocation | undefined,
  now: Date
) => {
  const actualBackedRowIndex = findLastActiveActualRowIndex(rows);
  if (actualBackedRowIndex >= 0) {
    return actualBackedRowIndex;
  }

  const scheduledRowIndex = rows.findIndex((row) => {
    const startTime = getDisplayTime(row.startEvent);
    const endTime = getDisplayTime(row.endEvent);

    return (
      startTime !== undefined &&
      endTime !== undefined &&
      now.getTime() >= startTime.getTime() &&
      now.getTime() <= endTime.getTime()
    );
  });

  if (scheduledRowIndex >= 0) {
    return scheduledRowIndex;
  }

  if (rows.length === 0) {
    return 0;
  }

  const firstStart = getDisplayTime(rows[0].startEvent);
  if (firstStart && now.getTime() < firstStart.getTime()) {
    return 0;
  }

  return rows.length - 1;
};

export const buildActiveIndicator = ({
  rows,
  activeRowIndex,
  vesselLocation,
  now,
  policy,
  layout,
}: {
  rows: TimelineSemanticRow[];
  activeRowIndex: number;
  vesselLocation: VesselLocation | undefined;
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
    vesselLocation,
    now,
    policy,
    layout
  );

  return {
    rowId: row.id,
    positionPercent,
    label: getMinutesUntil(row.endEvent, now),
    title: vesselLocation?.VesselName,
    subtitle: getIndicatorSubtitle(row, vesselLocation),
    animate:
      row.kind === "sea" &&
      isIndicatorActive(vesselLocation) &&
      (vesselLocation?.Speed ?? 0) > MOVING_SPEED_THRESHOLD_KNOTS,
    speedKnots: vesselLocation?.Speed ?? 0,
  };
};

const findLastActiveActualRowIndex = (rows: TimelineSemanticRow[]) =>
  rows.findLastIndex((row) => {
    const hasStarted = row.startEvent.ActualTime !== undefined;
    const hasEnded = row.endEvent.ActualTime !== undefined;

    return hasStarted && (!hasEnded || row.isTerminal === true);
  });

const isIndicatorActive = (vesselLocation: VesselLocation | undefined) =>
  vesselLocation?.InService !== false;

const getIndicatorSubtitle = (
  row: TimelineSemanticRow,
  vesselLocation: VesselLocation | undefined
) => {
  if (!vesselLocation) {
    return undefined;
  }

  if (row.kind === "dock") {
    const terminalAbbrev =
      vesselLocation.DepartingTerminalAbbrev ?? row.endEvent.TerminalAbbrev;
    return terminalAbbrev ? `At dock ${terminalAbbrev}` : "At dock";
  }

  const speed = vesselLocation.Speed ?? 0;
  const arrivalAbbrev =
    vesselLocation.ArrivingTerminalAbbrev ?? row.endEvent.TerminalAbbrev;
  if (vesselLocation.ArrivingDistance === undefined) {
    return `${speed.toFixed(0)} kn`;
  }

  const distancePart = arrivalAbbrev
    ? `${vesselLocation.ArrivingDistance.toFixed(1)} mi to ${arrivalAbbrev}`
    : `${vesselLocation.ArrivingDistance.toFixed(1)} mi`;

  return `${speed.toFixed(0)} kn · ${distancePart}`;
};

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

const getSeaProgress = (
  row: TimelineSemanticRow,
  vesselLocation: VesselLocation | undefined,
  now: Date
) => {
  const distanceProgress = getDistanceProgress(
    vesselLocation?.DepartingDistance,
    vesselLocation?.ArrivingDistance
  );

  return distanceProgress ?? getTimeProgress(row.startEvent, row.endEvent, now);
};

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

const getRowPositionPercent = (
  row: TimelineSemanticRow,
  vesselLocation: VesselLocation | undefined,
  now: Date,
  policy: VesselTimelinePolicy,
  layout: VesselTimelineLayoutConfig
) => {
  if (row.kind === "sea") {
    return getSeaProgress(row, vesselLocation, now);
  }

  if (row.displayMode !== "compressed-dock-break") {
    return getTimeProgress(row.startEvent, row.endEvent, now);
  }

  const naturalDisplayHeightPx = getDisplayHeightPx(row, layout);
  const offsetPx = getCompressedDockOffsetPx(row, now, policy, layout);

  return clamp(offsetPx / Math.max(1, naturalDisplayHeightPx), 0, 1);
};

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
