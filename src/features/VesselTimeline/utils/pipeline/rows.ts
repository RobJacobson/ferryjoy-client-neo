/**
 * Pipeline stage 2: convert boundary data into ordered dock/sea timeline rows.
 *
 * The day-level timeline alternates dock and sea segments. Dock rows represent
 * time from arrival at the current terminal until the scheduled departure for
 * that trip. Sea rows represent the trip crossing itself.
 */

import type { VesselTimelineTrip } from "@/data/contexts";
import type {
  VesselTimelineLayoutConfig,
  VesselTimelineRow,
  VesselTimelineRowDisplayMode,
  VesselTimelineTimePoint,
} from "../../types";
import type { TripBoundaryData } from "./boundaries";

const MS_PER_MINUTE = 60_000;
const MIN_DURATION_MINUTES = 1;

/**
 * Builds ordered dock and sea rows for the vessel-day timeline.
 *
 * @param trips - Ordered normalized vessel timeline trips
 * @param boundaryData - Boundary data derived from the trips
 * @param layout - Layout config used to mark compressed rows
 * @returns Ordered canonical rows for the day-level document
 */
export const getRows = (
  trips: VesselTimelineTrip[],
  boundaryData: TripBoundaryData[],
  layout: VesselTimelineLayoutConfig
): VesselTimelineRow[] => {
  const rows: VesselTimelineRow[] = [];

  boundaryData.forEach((tripBoundaries, index) => {
    const trip = trips[index];
    const dockStartBoundary = getDockStartBoundary(boundaryData, index);
    const dockDurationMinutes = getDurationMinutes(
      dockStartBoundary.timePoint,
      tripBoundaries.departCurr.timePoint
    );
    const seaDurationMinutes = getDurationMinutes(
      tripBoundaries.departCurr.timePoint,
      tripBoundaries.arriveNext.timePoint
    );

    if (shouldRenderDockRow(index, trip, dockDurationMinutes)) {
      rows.push({
        id: `${trip.key}-dock`,
        segmentIndex: rows.length,
        kind: "dock",
        startBoundary: dockStartBoundary,
        endBoundary: tripBoundaries.departCurr,
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

    rows.push({
      id: `${trip.key}-sea`,
      segmentIndex: rows.length,
      kind: "sea",
      startBoundary: tripBoundaries.departCurr,
      endBoundary: tripBoundaries.arriveNext,
      actualDurationMinutes: seaDurationMinutes,
      displayDurationMinutes: seaDurationMinutes,
      displayMode: "proportional",
    });
  });

  return rows;
};

/**
 * Resolves the dock-row start boundary so adjacent rows share a boundary when
 * the prior trip's arrival is available.
 *
 * @param boundaryData - Ordered boundary data for the day
 * @param index - Current trip index
 * @returns Boundary used as the dock-row start
 */
const getDockStartBoundary = (
  boundaryData: TripBoundaryData[],
  index: number
) => boundaryData[index - 1]?.arriveNext ?? boundaryData[index].arriveCurr;

/**
 * Determines whether a dock row is meaningful enough to render.
 *
 * The first trip of the day may not have a useful "arrive current" time. In
 * that case, we skip the row rather than manufacturing a zero-length segment.
 *
 * @param trip - Normalized vessel timeline trip
 * @param dockDurationMinutes - Derived dock duration for the trip
 * @returns True when a dock row should be rendered
 */
const shouldRenderDockRow = (
  index: number,
  trip: VesselTimelineTrip,
  dockDurationMinutes: number
) =>
  index > 0 ||
  trip.scheduledArriveCurr !== undefined ||
  trip.tripStart !== undefined ||
  trip.leftDock !== undefined ||
  dockDurationMinutes > MIN_DURATION_MINUTES;

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
