/**
 * Pipeline stage 5: compute the active indicator and final render state.
 */

import type { VesselLocation } from "@/data/contexts";
import { clamp } from "@/shared/utils";
import type {
  TimelineTerminalCard,
  VesselTimelineActiveIndicator,
  VesselTimelineDocument,
  VesselTimelineLayoutConfig,
  VesselTimelineRenderRow,
  VesselTimelineRenderState,
  VesselTimelineTimePoint,
} from "../../types";

const MS_PER_MINUTE = 60_000;
const MOVING_SPEED_THRESHOLD_KNOTS = 0.1;

type CardPosition = "none" | "top" | "bottom" | "single";

/**
 * Computes terminal card geometries for "at terminal" portions of the timeline.
 *
 * @param rows - Render-ready rows with explicit geometry
 * @param layout - Layout config for terminal card sizing
 * @returns Array of terminal card geometries for the view layer
 */
const computeTerminalCards = (
  rows: VesselTimelineRenderRow[],
  layout: VesselTimelineLayoutConfig
): TimelineTerminalCard[] => {
  const cards: TimelineTerminalCard[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const position = getCardPosition(rows, rowIndex);

    if (position === "none") {
      continue;
    }

    const topPx =
      position === "bottom"
        ? row.topPx
        : row.topPx + layout.terminalCardTopOffsetPx;
    const heightPx =
      position === "bottom"
        ? layout.terminalCardDepartureCapHeightPx
        : position === "single"
          ? row.displayHeightPx
          : row.displayHeightPx - layout.terminalCardTopOffsetPx;

    cards.push({
      rowId: row.id,
      position,
      topPx,
      heightPx,
    });
  }

  return cards;
};

const getCardPosition = (
  rows: VesselTimelineRenderRow[],
  rowIndex: number
): CardPosition => {
  const row = rows[rowIndex];
  if (!row) {
    return "none";
  }

  const previousRow = rowIndex > 0 ? rows[rowIndex - 1] : undefined;
  const nextRow = rows[rowIndex + 1];
  const rowTerminal = row.startBoundary.currTerminalAbbrev;

  const matchesNext =
    row.kind === "dock" &&
    nextRow?.kind === "sea" &&
    rowTerminal !== undefined &&
    rowTerminal === nextRow.startBoundary.currTerminalAbbrev;

  const matchesPrevious =
    previousRow?.kind === "dock" &&
    row.kind === "sea" &&
    previousRow.startBoundary.currTerminalAbbrev !== undefined &&
    previousRow.startBoundary.currTerminalAbbrev === rowTerminal;

  if (matchesNext) {
    return "top";
  }

  if (matchesPrevious) {
    return "bottom";
  }

  return row.kind === "dock" && rowTerminal ? "single" : "none";
};

/**
 * Builds the final vessel timeline render state.
 *
 * @param document - Canonical vessel timeline document
 * @param rows - Render-ready rows with explicit geometry
 * @param layout - Layout config used by the renderer
 * @param now - Current wall-clock time
 * @returns Final render state for the timeline UI
 */
export const renderState = (
  document: VesselTimelineDocument,
  rows: VesselTimelineRenderRow[],
  layout: VesselTimelineLayoutConfig,
  vesselLocation: VesselLocation | undefined,
  now: Date
): VesselTimelineRenderState => ({
  rows,
  terminalCards: computeTerminalCards(rows, layout),
  activeIndicator: getActiveIndicator(
    document,
    rows,
    layout,
    vesselLocation,
    now
  ),
  contentHeightPx:
    rows.length === 0
      ? 0
      : rows[rows.length - 1].topPx + rows[rows.length - 1].displayHeightPx,
  layout,
});

/**
 * Derives the active indicator for the current render pass.
 *
 * @param document - Canonical vessel timeline document
 * @param rows - Render-ready rows with explicit geometry
 * @param layout - Layout config used for compressed row mapping
 * @param now - Current wall-clock time
 * @returns Active indicator model, or null when there are no rows
 */
const getActiveIndicator = (
  document: VesselTimelineDocument,
  rows: VesselTimelineRenderRow[],
  layout: VesselTimelineLayoutConfig,
  vesselLocation: VesselLocation | undefined,
  now: Date
): VesselTimelineActiveIndicator | null => {
  const activeRow = rows[document.activeSegmentIndex];
  const sourceRow = document.rows[document.activeSegmentIndex];

  if (!activeRow || !sourceRow) {
    return null;
  }

  return {
    rowId: activeRow.id,
    rowIndex: activeRow.segmentIndex,
    topPx:
      activeRow.topPx +
      getRowOffsetPx(
        sourceRow,
        activeRow.displayHeightPx,
        layout,
        vesselLocation,
        now
      ),
    label: getMinutesUntil(sourceRow.endBoundary.timePoint, now),
    title: vesselLocation?.VesselName,
    subtitle: getIndicatorSubtitle(sourceRow, vesselLocation),
    state:
      document.indicatorState === "inactive-warning"
        ? "inactive-warning"
        : sourceRow.displayMode === "compressed-dock-break" &&
            isInCompressedMiddle(sourceRow, layout, now)
          ? "pinned-break"
          : document.indicatorState,
    animate:
      sourceRow.kind === "sea" &&
      document.indicatorState !== "inactive-warning" &&
      (vesselLocation?.Speed ?? 0) > MOVING_SPEED_THRESHOLD_KNOTS,
    speedKnots: vesselLocation?.Speed ?? 0,
  };
};

const getIndicatorSubtitle = (
  sourceRow: VesselTimelineDocument["rows"][number],
  vesselLocation: VesselLocation | undefined
) => {
  if (!vesselLocation) {
    return undefined;
  }

  if (sourceRow.kind === "dock") {
    const terminalAbbrev =
      vesselLocation.DepartingTerminalAbbrev ??
      sourceRow.endBoundary.terminalAbbrev;
    return terminalAbbrev ? `At dock ${terminalAbbrev}` : "At dock";
  }

  const speed = vesselLocation.Speed ?? 0;
  const arrivalAbbrev =
    vesselLocation.ArrivingTerminalAbbrev ??
    sourceRow.endBoundary.terminalAbbrev;
  if (vesselLocation.ArrivingDistance === undefined) {
    return `${speed.toFixed(0)} kn`;
  }
  const distancePart = arrivalAbbrev
    ? `${vesselLocation.ArrivingDistance.toFixed(1)} mi to ${arrivalAbbrev}`
    : `${vesselLocation.ArrivingDistance.toFixed(1)} mi`;
  return `${speed.toFixed(0)} kn · ${distancePart}`;
};

/**
 * Calculates distance-based in-transit progress when telemetry is available.
 *
 * @param departingDistance - Distance from the vessel to the departing terminal
 * @param arrivingDistance - Distance from the vessel to the arriving terminal
 * @returns Clamped distance ratio between 0 and 1, or null when unavailable
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
 * Returns preferred progress for a sea row: distance when telemetry is usable,
 * otherwise time-based fallback from the row boundaries.
 */
const getSeaProgress = (
  row: VesselTimelineDocument["rows"][number],
  vesselLocation: VesselLocation | undefined,
  now: Date
): number => {
  const distanceProgress =
    row.kind === "sea"
      ? getDistanceProgress(
          vesselLocation?.DepartingDistance,
          vesselLocation?.ArrivingDistance
        )
      : null;

  return (
    distanceProgress ??
    getTimeProgress(row.startBoundary.timePoint, row.endBoundary.timePoint, now)
  );
};

/**
 * Maps a row's current progress into its displayed pixel offset.
 *
 * @param row - Canonical row model
 * @param displayHeightPx - Row display height in pixels
 * @param layout - Layout config for compressed rows
 * @param vesselLocation - Live vessel telemetry used for at-sea distance progress
 * @param now - Current wall-clock time
 * @returns Pixel offset within the row
 */
const getRowOffsetPx = (
  row: VesselTimelineDocument["rows"][number],
  displayHeightPx: number,
  layout: VesselTimelineLayoutConfig,
  vesselLocation: VesselLocation | undefined,
  now: Date
) => {
  if (row.kind === "sea") {
    return displayHeightPx * getSeaProgress(row, vesselLocation, now);
  }

  if (row.displayMode !== "compressed-dock-break") {
    return (
      displayHeightPx *
      getTimeProgress(
        row.startBoundary.timePoint,
        row.endBoundary.timePoint,
        now
      )
    );
  }

  const startTime = getBoundaryTime(row.startBoundary.timePoint);
  const endTime = getBoundaryTime(row.endBoundary.timePoint);
  if (!startTime || !endTime) {
    return displayHeightPx / 2;
  }

  const totalMinutes = Math.max(
    1,
    (endTime.getTime() - startTime.getTime()) / MS_PER_MINUTE
  );
  const elapsedMinutes = Math.max(
    0,
    Math.min(
      totalMinutes,
      (now.getTime() - startTime.getTime()) / MS_PER_MINUTE
    )
  );
  const arrivalMinutes = layout.compressedBreakStubMinutes;
  const departureWindowMinutes = layout.compressedBreakDepartureWindowMinutes;
  const stubHeightPx = arrivalMinutes * layout.pixelsPerMinute;
  const departureHeightPx = departureWindowMinutes * layout.pixelsPerMinute;
  const breakHeightPx = layout.compressedBreakMarkerHeightPx;
  const totalDisplayHeightPx = stubHeightPx + breakHeightPx + departureHeightPx;

  if (elapsedMinutes <= arrivalMinutes) {
    return (elapsedMinutes / Math.max(1, arrivalMinutes)) * stubHeightPx;
  }

  if (totalMinutes - elapsedMinutes <= departureWindowMinutes) {
    const minutesIntoWindow =
      departureWindowMinutes - (totalMinutes - elapsedMinutes);
    return (
      stubHeightPx +
      breakHeightPx +
      (minutesIntoWindow / Math.max(1, departureWindowMinutes)) *
        departureHeightPx
    );
  }

  return Math.min(totalDisplayHeightPx, stubHeightPx + breakHeightPx / 2);
};

/**
 * Returns whether the current time falls inside the hidden middle of a
 * compressed dock-break row.
 *
 * @param row - Canonical compressed dock row
 * @param layout - Layout config for the visible slices
 * @param now - Current wall-clock time
 * @returns True when the indicator should pin at the break marker
 */
const isInCompressedMiddle = (
  row: VesselTimelineDocument["rows"][number],
  layout: VesselTimelineLayoutConfig,
  now: Date
) => {
  const startTime = getBoundaryTime(row.startBoundary.timePoint);
  const endTime = getBoundaryTime(row.endBoundary.timePoint);
  if (!startTime || !endTime) {
    return false;
  }

  const totalMinutes = Math.max(
    1,
    (endTime.getTime() - startTime.getTime()) / MS_PER_MINUTE
  );
  const elapsedMinutes = Math.max(
    0,
    Math.min(
      totalMinutes,
      (now.getTime() - startTime.getTime()) / MS_PER_MINUTE
    )
  );

  return (
    elapsedMinutes > layout.compressedBreakStubMinutes &&
    totalMinutes - elapsedMinutes > layout.compressedBreakDepartureWindowMinutes
  );
};

/**
 * Calculates simple time-based progress for proportional rows.
 *
 * @param startPoint - Starting time point
 * @param endPoint - Ending time point
 * @param now - Current wall-clock time
 * @returns Progress ratio between 0 and 1
 */
const getTimeProgress = (
  startPoint: VesselTimelineTimePoint,
  endPoint: VesselTimelineTimePoint,
  now: Date
) => {
  const startTime = getBoundaryTime(startPoint);
  const endTime = getBoundaryTime(endPoint);
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
 * Returns the best available time from a boundary time point.
 *
 * @param point - Time point with scheduled, actual, and estimated values
 * @returns Actual, estimated, or scheduled time in that order
 */
const getBoundaryTime = (point: VesselTimelineTimePoint) =>
  point.actual ?? point.estimated ?? point.scheduled;

/**
 * Produces the indicator label showing remaining minutes.
 *
 * @param point - End-boundary time point
 * @param now - Current wall-clock time
 * @returns Remaining minutes label or placeholder text
 */
const getMinutesUntil = (point: VesselTimelineTimePoint, now: Date) => {
  const targetTime = point.actual ?? point.estimated ?? point.scheduled;
  if (!targetTime) {
    return "--";
  }

  const remainingMinutes = Math.max(
    0,
    Math.ceil((targetTime.getTime() - now.getTime()) / MS_PER_MINUTE)
  );
  return `${remainingMinutes}m`;
};
