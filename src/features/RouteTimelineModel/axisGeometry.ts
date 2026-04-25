/**
 * Pure axis-geometry derivation from visual spans.
 */

import type { RouteTimelineBoundary } from "convex/functions/routeTimeline";
import type { RouteTimelineVisualSpan } from "./visualSpans";

export const START_OF_DAY_DOCK_VISUAL_CAP_MINUTES = 60;

export type RouteTimelineAxisGeometryConfig = {
  rowHeightBasePx: number;
  rowHeightScalePx: number;
  rowHeightExponent: number;
  minSpanHeightPx: number;
  startOfDayDockVisualCapMinutes: number;
};

export type RouteTimelineAxisSpan = RouteTimelineVisualSpan & {
  layoutDurationMinutes: number;
  displayDurationMinutes: number;
  visualDurationMinutes: number;
  startY: number;
  endY: number;
  y: number;
  heightPx: number;
};

export type RouteTimelineAxisGeometry = {
  spans: Array<RouteTimelineAxisSpan>;
  contentHeightPx: number;
};

export const DEFAULT_ROUTE_TIMELINE_AXIS_GEOMETRY_CONFIG: RouteTimelineAxisGeometryConfig =
  {
    rowHeightBasePx: 0,
    rowHeightScalePx: 14,
    rowHeightExponent: 0.75,
    minSpanHeightPx: 26,
    startOfDayDockVisualCapMinutes: START_OF_DAY_DOCK_VISUAL_CAP_MINUTES,
  };

/**
 * Derive absolute axis geometry from ordered visual spans.
 *
 * @param spans - Ordered visual spans
 * @param config - Optional geometry tuning configuration
 * @returns Absolute y geometry and total content height
 */
export const deriveRouteTimelineAxisGeometry = (
  spans: Array<RouteTimelineVisualSpan>,
  config: RouteTimelineAxisGeometryConfig = DEFAULT_ROUTE_TIMELINE_AXIS_GEOMETRY_CONFIG
): RouteTimelineAxisGeometry => {
  let runningY = 0;

  const axisSpans = spans.map((span) => {
    const layoutDurationMinutes = getDurationMinutes(
      getLayoutTime(span.startBoundary),
      getLayoutTime(span.endBoundary)
    );
    const displayDurationMinutes = getDurationMinutes(
      getDisplayTime(span.startBoundary),
      getDisplayTime(span.endBoundary)
    );
    const visualDurationMinutes = getVisualDurationMinutes(span, config);
    const heightPx = getSpanHeightPx(visualDurationMinutes, config);
    const startY = runningY;
    const endY = startY + heightPx;
    runningY = endY;

    return {
      ...span,
      layoutDurationMinutes,
      displayDurationMinutes,
      visualDurationMinutes,
      startY,
      endY,
      y: startY,
      heightPx,
    };
  });

  return {
    spans: axisSpans,
    contentHeightPx: runningY,
  };
};

/**
 * Resolve layout timing instant using schedule-first precedence.
 *
 * @param boundary - Route timeline boundary
 * @returns Preferred layout instant when available
 */
export const getLayoutTime = (
  boundary: RouteTimelineBoundary | undefined
): Date | undefined =>
  boundary?.EventScheduledTime ??
  boundary?.EventActualTime ??
  boundary?.EventPredictedTime;

/**
 * Resolve display/progress instant using actual/predicted/scheduled precedence.
 *
 * @param boundary - Route timeline boundary
 * @returns Preferred display instant when available
 */
export const getDisplayTime = (
  boundary: RouteTimelineBoundary | undefined
): Date | undefined =>
  boundary?.EventActualTime ??
  boundary?.EventPredictedTime ??
  boundary?.EventScheduledTime;

/**
 * Calculate interval duration in minutes from two optional instants.
 *
 * @param startTime - Interval start time
 * @param endTime - Interval end time
 * @returns Non-negative duration minutes
 */
const getDurationMinutes = (
  startTime: Date | undefined,
  endTime: Date | undefined
): number => {
  if (!startTime || !endTime) {
    return 0;
  }

  const durationMs = endTime.getTime() - startTime.getTime();
  if (durationMs <= 0) {
    return 0;
  }

  return durationMs / 60_000;
};

/**
 * Determine visual duration minutes used for compression/height math.
 *
 * @param span - Visual span
 * @param config - Geometry configuration
 * @returns Visual duration minutes with start-of-day cap applied
 */
const getVisualDurationMinutes = (
  span: RouteTimelineVisualSpan,
  config: RouteTimelineAxisGeometryConfig
): number => {
  const layoutDuration = getDurationMinutes(
    getLayoutTime(span.startBoundary),
    getLayoutTime(span.endBoundary)
  );
  if (span.kind === "at-dock" && span.edge === "start-of-day") {
    return Math.min(layoutDuration, config.startOfDayDockVisualCapMinutes);
  }

  return layoutDuration;
};

/**
 * Convert compressed visual duration into pixel height.
 *
 * @param visualDurationMinutes - Non-negative visual duration minutes
 * @param config - Geometry configuration
 * @returns Span height in pixels
 */
const getSpanHeightPx = (
  visualDurationMinutes: number,
  config: RouteTimelineAxisGeometryConfig
): number =>
  Math.max(
    config.minSpanHeightPx,
    config.rowHeightBasePx +
      config.rowHeightScalePx *
        Math.max(0, visualDurationMinutes) ** config.rowHeightExponent
  );
