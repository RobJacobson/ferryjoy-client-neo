/**
 * Time precedence helpers for feature-derived VesselTimeline rows.
 *
 * Layout uses schedule-first stability, while labels and the active indicator
 * use actual-then-predicted-then-scheduled display precedence.
 */

import type { VesselTimelineRowEvent } from "./types";

/**
 * Instant used for row duration and geometry.
 *
 * @param event - Derived row boundary event
 * @returns Schedule-first layout time
 */
export const getLayoutTime = (event: VesselTimelineRowEvent) =>
  event.EventScheduledTime ?? event.EventActualTime ?? event.EventPredictedTime;

/**
 * Instant shown in the UI and used for indicator math.
 *
 * @param event - Derived row boundary event
 * @returns Display-precedence event time
 */
export const getDisplayTime = (event: VesselTimelineRowEvent) =>
  event.EventActualTime ?? event.EventPredictedTime ?? event.EventScheduledTime;
