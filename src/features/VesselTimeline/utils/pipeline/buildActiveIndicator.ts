/**
 * Active-indicator payload construction for the vessel-day timeline.
 *
 * Derives indicator position, labels, and motion hints from the currently
 * active semantic segment plus backend live state.
 */

import type { TimelineActiveIndicator } from "@/components/timeline";
import type {
  VesselTimelineActiveState,
  VesselTimelineLiveState,
  VesselTimelineSegment,
} from "@/data/contexts";
import { clamp } from "@/shared/utils";
import { getDisplayTime, getLayoutTime } from "../shared/rowEventTime";

/**
 * Builds the floating indicator descriptor for the active segment, or null.
 *
 * @param segments - Semantic segments (same array passed to layout)
 * @param activeSegmentIndex - Segment index from `resolveActiveSegmentIndex`
 * @param activeState - Backend-resolved active segment state and copy
 * @param liveState - Compact live vessel state for title, motion, and progress
 * @param now - Wall clock for countdown label and progress
 * @returns `TimelineActiveIndicator` or null when the segment is missing
 */
export const buildActiveIndicator = ({
  segments,
  activeSegmentIndex,
  activeState,
  liveState,
  now,
}: {
  segments: VesselTimelineSegment[];
  activeSegmentIndex: number;
  activeState: VesselTimelineActiveState | null;
  liveState: VesselTimelineLiveState | null;
  now: Date;
}): TimelineActiveIndicator | null => {
  const segment = segments[activeSegmentIndex];
  if (!segment) {
    return null;
  }

  const positionPercent = getSegmentPositionPercent(segment, liveState, now);

  return {
    rowId: segment.id,
    positionPercent,
    label: getMinutesUntil(segment.endEvent, now),
    title: liveState?.VesselName,
    subtitle: activeState?.subtitle,
    animate: activeState?.animate ?? false,
    speedKnots: activeState?.speedKnots ?? liveState?.Speed ?? 0,
  };
};

/**
 * Fraction along the sea leg from departing vs arriving distance when both
 * exist and sum to a positive value.
 *
 * @param departingDistance - Nautical miles from departure terminal
 * @param arrivingDistance - Nautical miles to arrival terminal
 * @returns Progress 0–1, or null when distances are unusable
 */
const getDistanceProgress = (
  departingDistance: number | undefined,
  arrivingDistance: number | undefined
) => {
  if (
    departingDistance === undefined ||
    arrivingDistance === undefined ||
    departingDistance + arrivingDistance <= 0
  ) {
    return null;
  }

  return clamp(
    departingDistance / (departingDistance + arrivingDistance),
    0,
    1
  );
};

/**
 * Indicator position along a sea segment from live distance when available,
 * with an ETA-over-actual-departure fallback when distances are unavailable.
 *
 * @param segment - Active sea semantic segment
 * @param liveState - Live distances when available
 * @returns Position along the segment in 0–1
 */
const getSeaProgress = (
  segment: VesselTimelineSegment,
  liveState: VesselTimelineLiveState | null,
  now: Date
) => {
  const distanceProgress = getDistanceProgress(
    liveState?.DepartingDistance,
    liveState?.ArrivingDistance
  );

  if (distanceProgress !== null) {
    return distanceProgress;
  }

  return getEtaFallbackProgress(segment, liveState, now);
};

/**
 * Sea fallback progress from actual departure to live ETA when distance data is
 * unavailable.
 *
 * @param segment - Active sea segment
 * @param liveState - Live state carrying `Eta` and optional `LeftDock`
 * @param now - Current instant
 * @returns 0–1 progress or `0` when the fallback inputs are unusable
 */
const getEtaFallbackProgress = (
  segment: VesselTimelineSegment,
  liveState: VesselTimelineLiveState | null,
  now: Date
) => {
  const departureTime = segment.startEvent.ActualTime ?? liveState?.LeftDock;
  const etaTime = liveState?.Eta;

  if (!departureTime || !etaTime) {
    return 0;
  }

  const totalMs = etaTime.getTime() - departureTime.getTime();
  if (totalMs <= 0) {
    return 0;
  }

  return clamp((now.getTime() - departureTime.getTime()) / totalMs, 0, 1);
};

/**
 * Maps the active segment to a 0–1 position for the timeline indicator dot.
 *
 * Sea segments use `getSeaProgress`; dock segments use schedule-first elapsed
 * time so the indicator stays aligned with schedule-sized rows as live ETA
 * data drifts.
 *
 * @param segment - Active semantic segment
 * @param liveState - Live state for sea progress
 * @param now - Current instant
 * @returns Vertical position as a fraction of segment height
 */
const getSegmentPositionPercent = (
  segment: VesselTimelineSegment,
  liveState: VesselTimelineLiveState | null,
  now: Date
) => {
  if (segment.kind === "sea") {
    return getSeaProgress(segment, liveState, now);
  }

  return getTimeProgress(
    segment.startEvent,
    segment.endEvent,
    now,
    getLayoutTime
  );
};

/**
 * Linear time progress between two segment boundary events using the supplied
 * event-time selector.
 *
 * @param startEvent - Segment start event
 * @param endEvent - Segment end event
 * @param now - Current instant
 * @param getEventTime - Function that selects the timeline instant for an event
 * @returns 0–1 clamped fraction through the span
 */
const getTimeProgress = (
  startEvent: VesselTimelineSegment["startEvent"],
  endEvent: VesselTimelineSegment["endEvent"],
  now: Date,
  getEventTime = getDisplayTime
) => {
  const startTime = getEventTime(startEvent);
  const endTime = getEventTime(endEvent);
  if (!startTime || !endTime) {
    return 0;
  }

  const durationMs = endTime.getTime() - startTime.getTime();
  if (durationMs <= 0) {
    return 0;
  }

  return clamp((now.getTime() - startTime.getTime()) / durationMs, 0, 1);
};

/**
 * Countdown minutes until the event’s display time for the badge label.
 *
 * @param event - Segment end event
 * @param now - Current instant
 * @returns String such as `12m`, or `--` when time is unknown
 */
const getMinutesUntil = (
  event: VesselTimelineSegment["endEvent"],
  now: Date
) => {
  const targetTime = getDisplayTime(event);
  if (!targetTime) {
    return "--";
  }

  const remainingMinutes = Math.max(
    0,
    Math.ceil((targetTime.getTime() - now.getTime()) / 60_000)
  );

  return `${remainingMinutes}m`;
};
