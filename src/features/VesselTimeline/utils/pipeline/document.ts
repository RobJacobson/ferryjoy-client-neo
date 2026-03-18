/**
 * Pipeline stage 3: assemble the canonical day-level document and active cursor.
 */

import type { VesselLocation } from "@/data/contexts";
import type {
  VesselTimelineDocument,
  VesselTimelineIndicatorState,
  VesselTimelineRow,
} from "../../types";

/**
 * Builds the canonical vessel timeline document.
 *
 * @param rows - Canonical timeline rows derived from the trips
 * @param vesselLocation - Current vessel location when available
 * @param now - Current wall-clock time
 * @returns Canonical vessel timeline document
 */
export const getDocument = (
  rows: VesselTimelineRow[],
  vesselLocation: VesselLocation | undefined,
  now: Date
): VesselTimelineDocument => ({
  rows,
  activeSegmentIndex: getActiveSegmentIndex(rows, vesselLocation, now),
  indicatorState: getIndicatorState(vesselLocation),
});

/**
 * Determines the document-level indicator state.
 *
 * @param vesselLocation - Current vessel location when available
 * @returns Indicator state for the overall timeline
 */
const getIndicatorState = (
  vesselLocation: VesselLocation | undefined
): VesselTimelineIndicatorState => {
  if (vesselLocation && !vesselLocation.InService) {
    return "inactive-warning";
  }

  return "active";
};

/**
 * Resolves the active row index for the day-level timeline.
 *
 * This prefers current operational evidence from vessel location. When there is
 * no matching live anchor, it falls back to clock-based scheduled progress.
 *
 * @param rows - Canonical timeline rows
 * @param vesselLocation - Current vessel location when available
 * @param now - Current wall-clock time
 * @returns Active row index or the final row when the day appears complete
 */
const getActiveSegmentIndex = (
  rows: VesselTimelineRow[],
  vesselLocation: VesselLocation | undefined,
  now: Date
) => {
  const scheduledDepartureMs = vesselLocation?.ScheduledDeparture?.getTime();
  if (scheduledDepartureMs !== undefined) {
    const liveRow = rows.findIndex((row) =>
      isLiveAnchoredRow(row, vesselLocation, scheduledDepartureMs)
    );
    if (liveRow >= 0) {
      return liveRow;
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

const isLiveAnchoredRow = (
  row: VesselTimelineRow,
  vesselLocation: VesselLocation | undefined,
  scheduledDepartureMs: number
) => {
  if (!vesselLocation) {
    return false;
  }

  const isMoving =
    vesselLocation.AtDock === false && vesselLocation.Speed >= 0.2;
  if (isMoving && row.kind === "sea") {
    return (
      row.startBoundary.timePoint.scheduled?.getTime() === scheduledDepartureMs
    );
  }

  if (vesselLocation.AtDock && row.kind === "dock") {
    return (
      row.endBoundary.timePoint.scheduled?.getTime() === scheduledDepartureMs
    );
  }

  return false;
};
