/**
 * Pipeline stage 2: convert adjacent event boundaries into dock/sea rows.
 */

import type {
  VesselTimelineLayoutConfig,
  VesselTimelineRow,
  VesselTimelineRowDisplayMode,
  VesselTimelineTimePoint,
} from "../../types";
import type { EventBoundaryData } from "./boundaries";

const MS_PER_MINUTE = 60_000;
const MIN_DURATION_MINUTES = 1;

/**
 * Builds ordered dock and sea rows for the vessel-day timeline.
 *
 * @param boundaryData - Boundary data derived from ordered events
 * @param layout - Layout config used to mark compressed rows
 * @returns Ordered canonical rows for the day-level document
 */
export const getRows = (
  boundaryData: EventBoundaryData[],
  layout: VesselTimelineLayoutConfig
): VesselTimelineRow[] => {
  const rows: VesselTimelineRow[] = [];

  for (let index = 0; index < boundaryData.length - 1; index++) {
    const current = boundaryData[index];
    const next = boundaryData[index + 1];

    if (!current || !next) {
      continue;
    }

    if (isDockPair(current, next)) {
      const dockDurationMinutes = getDurationMinutes(
        current.boundary.timePoint,
        next.boundary.timePoint
      );

      rows.push({
        id: `${current.Key}--${next.Key}--dock`,
        segmentIndex: rows.length,
        kind: "dock",
        startBoundary: current.boundary,
        endBoundary: next.boundary,
        actualDurationMinutes: dockDurationMinutes,
        displayDurationMinutes: getDisplayDurationMinutes(
          dockDurationMinutes,
          getDockDisplayMode(dockDurationMinutes, layout),
          layout
        ),
        displayMode: getDockDisplayMode(dockDurationMinutes, layout),
        compression:
          dockDurationMinutes >= layout.compressedBreakThresholdMinutes
            ? {
                thresholdMinutes: layout.compressedBreakThresholdMinutes,
                visibleArrivalMinutes: layout.compressedBreakStubMinutes,
                visibleDepartureMinutes:
                  layout.compressedBreakDepartureWindowMinutes,
              }
            : undefined,
      });
    }

    if (isSeaPair(current, next)) {
      const seaDurationMinutes = getDurationMinutes(
        current.boundary.timePoint,
        next.boundary.timePoint
      );

      rows.push({
        id: `${current.Key}--${next.Key}--sea`,
        segmentIndex: rows.length,
        kind: "sea",
        startBoundary: current.boundary,
        endBoundary: next.boundary,
        actualDurationMinutes: seaDurationMinutes,
        displayDurationMinutes: seaDurationMinutes,
        displayMode: "proportional",
      });
    }
  }

  const lastBoundary = boundaryData[boundaryData.length - 1];
  if (lastBoundary?.EventType === "arv-dock") {
    rows.push({
      id: `${lastBoundary.Key}--terminal`,
      segmentIndex: rows.length,
      kind: "dock",
      isTerminal: true,
      startBoundary: lastBoundary.boundary,
      endBoundary: lastBoundary.boundary,
      actualDurationMinutes: 0,
      displayDurationMinutes: 0,
      displayMode: "proportional",
    });
  }

  return rows;
};

const isDockPair = (current: EventBoundaryData, next: EventBoundaryData) =>
  current.EventType === "arv-dock" &&
  next.EventType === "dep-dock" &&
  current.TerminalAbbrev === next.TerminalAbbrev;

const isSeaPair = (current: EventBoundaryData, next: EventBoundaryData) =>
  current.EventType === "dep-dock" && next.EventType === "arv-dock";

/**
 * Resolves the display mode for a dock row.
 *
 * @param durationMinutes - Actual duration of the dock segment
 * @param layout - Layout config
 * @returns Dock display mode
 */
const getDockDisplayMode = (
  durationMinutes: number,
  layout: VesselTimelineLayoutConfig
): VesselTimelineRowDisplayMode =>
  durationMinutes >= layout.compressedBreakThresholdMinutes
    ? "compressed-dock-break"
    : "proportional";

/**
 * Calculates the displayed duration used for pixel sizing.
 *
 * Compressed dock rows intentionally hide the long middle duration and render
 * only the visible arrival stub plus visible departure window.
 *
 * @param durationMinutes - Actual segment duration
 * @param displayMode - Row display mode
 * @param layout - Layout config
 * @returns Duration in minutes used for layout sizing
 */
const getDisplayDurationMinutes = (
  durationMinutes: number,
  displayMode: VesselTimelineRowDisplayMode,
  layout: VesselTimelineLayoutConfig
) =>
  displayMode === "compressed-dock-break"
    ? layout.compressedBreakStubMinutes +
      layout.compressedBreakDepartureWindowMinutes
    : durationMinutes;

/**
 * Returns the best available timestamp from a timeline time point.
 *
 * @param point - Timeline time point with scheduled, actual, and estimated data
 * @returns Best available date for duration calculations
 */
const getBoundaryTime = (point: VesselTimelineTimePoint) =>
  point.actual ?? point.estimated ?? point.scheduled;

/**
 * Calculates the duration between two boundaries in minutes.
 *
 * @param startPoint - Starting boundary time point
 * @param endPoint - Ending boundary time point
 * @returns Positive duration in minutes with a one-minute minimum
 */
const getDurationMinutes = (
  startPoint: VesselTimelineTimePoint,
  endPoint: VesselTimelineTimePoint
) => {
  const startTime = getBoundaryTime(startPoint);
  const endTime = getBoundaryTime(endPoint);

  if (!startTime || !endTime) {
    return MIN_DURATION_MINUTES;
  }

  const minutes = (endTime.getTime() - startTime.getTime()) / MS_PER_MINUTE;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return MIN_DURATION_MINUTES;
  }

  return Math.max(MIN_DURATION_MINUTES, minutes);
};
