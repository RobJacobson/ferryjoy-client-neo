/**
 * Time precedence helpers for vessel-day semantic rows.
 *
 * Layout uses schedule-first stability; labels and the active indicator use
 * actual-then-predicted-then-scheduled display precedence.
 */

import type { MergedTimelineBoundaryEvent } from "convex/functions/vesselTimeline/schemas";
import type { VesselTimelineSegment } from "@/data/contexts";

type TimelineEvent =
  | VesselTimelineSegment["startEvent"]
  | MergedTimelineBoundaryEvent;

/**
 * Instant used for row duration and geometry (stable as live data updates).
 */
export const getLayoutTime = (event: TimelineEvent) =>
  event.EventScheduledTime ?? event.EventActualTime ?? event.EventPredictedTime;

/**
 * Instant shown in UI and used for indicator math when not otherwise
 * overridden.
 */
export const getDisplayTime = (event: TimelineEvent) =>
  event.EventActualTime ?? event.EventPredictedTime ?? event.EventScheduledTime;
