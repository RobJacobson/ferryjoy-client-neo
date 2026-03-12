/**
 * Derives render-ready row and indicator state from the canonical timeline document.
 */

import { clamp } from "@/shared/utils";
import type {
  TimelineActiveIndicator,
  TimelineDocument,
  TimelineDocumentRow,
  TimelineItem,
  TimelineRenderBoundary,
  TimelineRenderRow,
  TimelineRenderState,
} from "../types";
import { getMinutesUntil } from "./getMinutesUntil";
import { getActiveTimelineRow, getTimelineRowPhase } from "./timelineDocument";
import { getDisplayTime, getSegmentTimeProgress } from "./timePoints";

const ACTIVE_DOCK_MIN_OFFSET = 0.06;

/**
 * Converts the canonical document into render-ready rows plus the active
 * overlay indicator.
 *
 * @param document - Canonical timeline document
 * @param item - Vessel trip and location pair for telemetry-based progress
 * @param now - Current wall-clock time
 * @returns Render-ready rows and active indicator for the overlay renderer
 */
export const selectTimelineRenderState = (
  document: TimelineDocument,
  item: TimelineItem,
  now: Date = new Date()
): TimelineRenderState => {
  const activeIndicator = getActiveIndicator(document, item, now);

  return {
    rows: document.rows.map((row, index) => {
      const phase = getTimelineRowPhase(
        row.segmentIndex,
        document.activeSegmentIndex
      );

      return {
        id: row.id,
        kind: row.kind,
        segmentIndex: row.segmentIndex,
        geometryMinutes: row.geometryMinutes,
        startBoundary: getStartBoundary(row, phase),
        isFinalRow: index === document.rows.length - 1,
      } satisfies TimelineRenderRow;
    }),
    activeIndicator,
  };
};

/**
 * Derives the overlay indicator for the currently active row.
 *
 * @param document - Canonical timeline document
 * @param item - Vessel trip and telemetry data
 * @param now - Current wall-clock time
 * @returns Active overlay indicator, or null when no rows exist
 */
const getActiveIndicator = (
  document: TimelineDocument,
  item: TimelineItem,
  now: Date
): TimelineActiveIndicator | null => {
  const activeRow = getActiveTimelineRow(document);

  if (!activeRow) {
    return null;
  }

  const positionPercent = getIndicatorPositionPercent(
    activeRow,
    document,
    item,
    now
  );

  return {
    rowId: activeRow.id,
    rowIndex: activeRow.segmentIndex,
    positionPercent,
    label: getMinutesUntil(
      getDisplayTime(activeRow.endBoundary.timePoint),
      now
    ),
  };
};

/**
 * Calculates active-indicator progress for the owning row.
 *
 * @param row - Active row that owns the indicator
 * @param document - Canonical timeline document
 * @param item - Vessel trip and telemetry data
 * @param now - Current wall-clock time
 * @returns Row-local indicator position between 0 and 1
 */
const getIndicatorPositionPercent = (
  row: TimelineDocumentRow,
  document: TimelineDocument,
  item: TimelineItem,
  now: Date
): number => {
  if (document.activeSegmentIndex >= document.rows.length) {
    return 1;
  }

  if (document.activeSegmentIndex < 0) {
    return 0;
  }

  if (row.progressMode === "distance" && row.kind === "at-sea") {
    return getDistanceProgress(
      item.vesselLocation.DepartingDistance,
      item.vesselLocation.ArrivingDistance
    );
  }

  const timeProgress = getSegmentTimeProgress(row, now);

  if (row.kind === "at-dock" && row.segmentIndex === 0) {
    return Math.max(ACTIVE_DOCK_MIN_OFFSET, timeProgress);
  }

  return timeProgress;
};

/**
 * Builds the render-ready start boundary for a row.
 *
 * @param row - Canonical document row
 * @param phase - Lifecycle phase used to choose tense
 * @returns Start boundary label and timepoint
 */
const getStartBoundary = (
  row: TimelineDocumentRow,
  phase: "upcoming" | "active" | "completed"
): TimelineRenderBoundary => ({
  label:
    row.kind === "at-dock"
      ? phase === "upcoming"
        ? "Arriving"
        : "Arrived"
      : phase === "upcoming"
        ? "Departing to"
        : "Departed to",
  terminalAbbrev:
    row.kind === "at-dock"
      ? row.startBoundary.terminalAbbrev
      : row.endBoundary.terminalAbbrev,
  timePoint: row.startBoundary.timePoint,
});

/**
 * Calculates distance-based in-transit progress when telemetry is available.
 *
 * @param departingDistance - Remaining distance from the departure terminal
 * @param arrivingDistance - Remaining distance to the arrival terminal
 * @returns Clamped distance ratio between 0 and 1
 */
const getDistanceProgress = (
  departingDistance: number | undefined,
  arrivingDistance: number | undefined
): number => {
  if (
    departingDistance === undefined ||
    arrivingDistance === undefined ||
    departingDistance + arrivingDistance <= 0
  ) {
    return 0;
  }

  return clamp(
    departingDistance / (departingDistance + arrivingDistance),
    0,
    1
  );
};
