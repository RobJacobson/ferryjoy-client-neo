/**
 * Time precedence helpers for vessel-day semantic rows.
 *
 * Layout uses schedule-first stability; labels and the active indicator use
 * actual-then-predicted-then-scheduled display precedence. See
 * `ARCHITECTURE.md` (“Duration calculations” / “Field precedence”).
 */

import type { TimelineRowEvent } from "../../types";

/**
 * Instant used for row duration and geometry (stable as live data updates).
 *
 * @param event - Row boundary event from the backend feed
 * @returns `ScheduledTime`, else `ActualTime`, else `PredictedTime`
 */
export const getLayoutTime = (event: TimelineRowEvent) =>
  event.ScheduledTime ?? event.ActualTime ?? event.PredictedTime;

/**
 * Instant shown in UI and used for “where is now” indicator math when not
 * overridden by row-specific rules.
 *
 * @param event - Row boundary event from the backend feed
 * @returns `ActualTime`, else `PredictedTime`, else `ScheduledTime`
 */
export const getDisplayTime = (event: TimelineRowEvent) =>
  event.ActualTime ?? event.PredictedTime ?? event.ScheduledTime;
