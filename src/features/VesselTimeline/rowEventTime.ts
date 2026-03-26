/**
 * Time precedence helpers for vessel-day semantic rows.
 *
 * Layout uses schedule-first stability; labels and the active indicator use
 * actual-then-predicted-then-scheduled display precedence.
 */

import type { VesselTimelineSegment } from "@/data/contexts";
import type { MergedTimelineBoundaryEvent } from "convex/functions/vesselTimeline/schemas";

type TimelineEvent =
  | VesselTimelineSegment["startEvent"]
  | MergedTimelineBoundaryEvent;

/**
 * Instant used for row duration and geometry (stable as live data updates).
 */
export const getLayoutTime = (event: TimelineEvent) =>
  event.ScheduledTime ?? event.ActualTime ?? event.PredictedTime;

/**
 * Instant shown in UI and used for indicator math when not otherwise
 * overridden.
 */
export const getDisplayTime = (event: TimelineEvent) =>
  event.ActualTime ?? event.PredictedTime ?? event.ScheduledTime;
