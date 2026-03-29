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
import { getDisplayTime } from "../rowEventTime";

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

  return {
    rowId: segment.id,
    positionPercent: getPositionPercent(segment, liveState, now),
    label: getMinutesUntil(segment, now),
    title: liveState?.VesselName,
    subtitle: activeState?.subtitle,
    animate: activeState?.animate ?? false,
    speedKnots: activeState?.speedKnots ?? liveState?.Speed ?? 0,
  };
};

/**
 * Fraction along the sea leg from departing vs arriving distance when both
 * exist.
 *
 * @param departingDistance - Nautical miles from departure terminal
 * @param arrivingDistance - Nautical miles to arrival terminal
 * @returns Progress 0–1
 */
const getDistanceProgress = (
  departingDistance: number,
  arrivingDistance: number
) => clamp(departingDistance / (departingDistance + arrivingDistance), 0, 1);

/**
 * Maps the active segment to a 0–1 position for the timeline indicator dot.
 *
 * Sea segments use live distance when `ArrivingDistance` is present; otherwise
 * they fall back to display-time progress. Dock segments always use
 * display-time bounds, so late arrivals and predicted departures shift the
 * indicator within the schedule-sized row without changing row geometry.
 *
 * @param segment - Active semantic segment
 * @param liveState - Live state for sea progress
 * @param now - Current instant
 * @returns Vertical position as a fraction of segment height
 */
const getPositionPercent = (
  segment: VesselTimelineSegment,
  liveState: VesselTimelineLiveState | null,
  now: Date
) =>
  segment.kind === "sea" &&
  liveState?.DepartingDistance !== undefined &&
  liveState?.ArrivingDistance !== undefined
    ? getDistanceProgress(
        liveState.DepartingDistance,
        liveState.ArrivingDistance
      )
    : getTimeProgress(segment.startEvent, segment.endEvent, now);

/**
 * Linear time progress between two segment boundary events using display-time
 * precedence.
 *
 * @param startEvent - Segment start event
 * @param endEvent - Segment end event
 * @param now - Current instant
 * @returns 0–1 clamped fraction through the span
 */
const getTimeProgress = (
  startEvent: VesselTimelineSegment["startEvent"],
  endEvent: VesselTimelineSegment["endEvent"],
  now: Date
) =>
  getClampedProgress(getDisplayTime(startEvent), getDisplayTime(endEvent), now);

/**
 * Clamped elapsed progress between two instants.
 *
 * Returns `0` when either instant is missing or when the interval is not
 * positive.
 *
 * @param startTime - Interval start
 * @param endTime - Interval end
 * @param now - Current instant
 * @returns 0–1 clamped progress through the interval
 */
const getClampedProgress = (
  startTime: Date | undefined,
  endTime: Date | undefined,
  now: Date
) => {
  if (!startTime || !endTime) {
    return 0;
  }

  const totalMs = endTime.getTime() - startTime.getTime();
  if (totalMs <= 0) {
    return 0;
  }

  return clamp((now.getTime() - startTime.getTime()) / totalMs, 0, 1);
};

/**
 * Countdown minutes until the event’s display time for the badge label.
 *
 * @param segment - Active segment
 * @param now - Current instant
 * @returns String such as `12m`, or `--` when time is unknown
 */
const getMinutesUntil = (segment: VesselTimelineSegment, now: Date) => {
  if (segment.isTerminal === true) {
    return "--";
  }

  const event = segment.endEvent;
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
