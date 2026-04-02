/**
 * Time precedence helpers for backend-owned VesselTimeline rows.
 *
 * Layout uses schedule-first stability, while labels and the active indicator
 * use actual-then-predicted-then-scheduled display precedence.
 */

import type { VesselTimelineRowEvent } from "convex/functions/vesselTimeline/schemas";

/**
 * Instant used for row duration and geometry.
 *
 * @param event - Backend-owned row boundary event
 * @returns Schedule-first layout time
 */
export const getLayoutTime = (event: VesselTimelineRowEvent) =>
  event.EventScheduledTime ?? event.EventActualTime ?? event.EventPredictedTime;

/**
 * Instant shown in the UI and used for indicator math.
 *
 * @param event - Backend-owned row boundary event
 * @returns Display-precedence event time
 */
export const getDisplayTime = (event: VesselTimelineRowEvent) =>
  event.EventActualTime ?? event.EventPredictedTime ?? event.EventScheduledTime;
