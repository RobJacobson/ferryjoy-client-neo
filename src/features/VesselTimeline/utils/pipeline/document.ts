/**
 * Pipeline stage 3: assemble the canonical day-level document and active cursor.
 */

import type { VesselLocation, VesselTimelineTrip } from "@/data/contexts";
import type {
  VesselTimelineDocument,
  VesselTimelineIndicatorState,
  VesselTimelineRow,
} from "../../types";

/**
 * Builds the canonical vessel timeline document.
 *
 * @param trips - Ordered normalized vessel timeline trips
 * @param rows - Canonical timeline rows derived from the trips
 * @param vesselLocation - Current vessel location when available
 * @param now - Current wall-clock time
 * @returns Canonical vessel timeline document
 */
export const getDocument = (
  trips: VesselTimelineTrip[],
  rows: VesselTimelineRow[],
  vesselLocation: VesselLocation | undefined,
  now: Date
): VesselTimelineDocument => ({
  rows,
  activeSegmentIndex: getActiveSegmentIndex(trips, rows, vesselLocation, now),
  indicatorState: getIndicatorState(trips, vesselLocation),
});

/**
 * Determines the document-level indicator state.
 *
 * @param trips - Ordered normalized vessel timeline trips
 * @param vesselLocation - Current vessel location when available
 * @returns Indicator state for the overall timeline
 */
const getIndicatorState = (
  trips: VesselTimelineTrip[],
  vesselLocation: VesselLocation | undefined
): VesselTimelineIndicatorState => {
  if (vesselLocation && !vesselLocation.InService) {
    return "inactive-warning";
  }

  if (
    vesselLocation?.RouteAbbrev &&
    trips.length > 0 &&
    !trips.some((trip) => trip.routeAbbrev === vesselLocation.RouteAbbrev)
  ) {
    return "inactive-warning";
  }

  return "active";
};

/**
 * Resolves the active row index for the day-level timeline.
 *
 * This prefers current operational evidence from active trip data. When there is
 * no active trip, it falls back to clock-based scheduled progress.
 *
 * @param trips - Ordered normalized vessel timeline trips
 * @param rows - Canonical timeline rows
 * @param vesselLocation - Current vessel location when available
 * @param now - Current wall-clock time
 * @returns Active row index or the final row when the day appears complete
 */
const getActiveSegmentIndex = (
  trips: VesselTimelineTrip[],
  rows: VesselTimelineRow[],
  _vesselLocation: VesselLocation | undefined,
  now: Date
) => {
  const activeTrip = trips.find((trip) => trip.hasActiveData);
  if (activeTrip) {
    const rowId = activeTrip.leftDock
      ? `${activeTrip.key}-sea`
      : `${activeTrip.key}-dock`;
    const rowIndex = rows.findIndex((row) => row.id === rowId);
    if (rowIndex >= 0) {
      return rowIndex;
    }
  }

  const completedTrip = [...trips]
    .reverse()
    .find((trip) => trip.hasCompletedData || trip.tripEnd || trip.arriveDest);
  if (completedTrip) {
    const rowIndex = rows.findIndex(
      (row) => row.id === `${completedTrip.key}-sea`
    );
    if (rowIndex >= 0) {
      return rowIndex;
    }
  }

  const scheduledRow = rows.findIndex((row) => {
    const startTime = getBoundaryTime(row.startBoundary.timePoint);
    const endTime = getBoundaryTime(row.endBoundary.timePoint);
    return (
      startTime !== undefined &&
      endTime !== undefined &&
      now.getTime() >= startTime.getTime() &&
      now.getTime() <= endTime.getTime()
    );
  });

  if (scheduledRow >= 0) {
    return scheduledRow;
  }

  if (rows.length === 0) {
    return 0;
  }

  const firstStart = getBoundaryTime(rows[0].startBoundary.timePoint);
  if (firstStart && now.getTime() < firstStart.getTime()) {
    return 0;
  }

  return rows.length - 1;
};

/**
 * Returns the best available timestamp for document-level cursor logic.
 *
 * @param point - Timeline time point
 * @returns Actual, estimated, or scheduled time in that order
 */
const getBoundaryTime = (
  point: VesselTimelineRow["startBoundary"]["timePoint"]
) => point.actual ?? point.estimated ?? point.scheduled;
