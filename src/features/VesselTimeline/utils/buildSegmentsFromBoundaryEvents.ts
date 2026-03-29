/**
 * Builds semantic VesselTimeline segments from normalized boundary events.
 */

import type {
  MergedTimelineBoundaryEvent,
  VesselTimelineSegment,
  VesselTimelineSegmentEvent,
} from "convex/functions/vesselTimeline/schemas";
import { getTerminalNameByAbbrev } from "@/data/terminalLocations";
import { getLayoutTime } from "../rowEventTime";

/**
 * Converts ordered merged boundary events into semantic dock and sea segments.
 *
 * @param events - Ordered boundary events merged from scheduled, actual, and predicted data
 * @returns Semantic timeline segments for VesselTimeline rendering
 */
export const buildSegmentsFromBoundaryEvents = (
  events: MergedTimelineBoundaryEvent[]
): VesselTimelineSegment[] => {
  const segments: VesselTimelineSegment[] = [];

  for (let index = 0; index < events.length - 1; index++) {
    const previous = index > 0 ? events[index - 1] : undefined;
    const current = events[index];
    const next = events[index + 1];

    if (!current || !next) {
      continue;
    }

    if (isDockPair(current, next)) {
      segments.push({
        id: `${current.Key}--${next.Key}--dock`,
        segmentIndex: segments.length,
        kind: "dock",
        startEvent: toSegmentEvent(current),
        endEvent: toSegmentEvent(next),
        durationMinutes: getDurationMinutes(current, next),
      });
    }

    if (isSeaPair(current, next)) {
      if (needsArrivalPlaceholder(previous, current)) {
        segments.push(
          buildArrivalPlaceholderSegment(current, segments.length, index)
        );
      }

      segments.push({
        id: `${current.Key}--${next.Key}--sea`,
        segmentIndex: segments.length,
        kind: "sea",
        startEvent: toSegmentEvent(current),
        endEvent: toSegmentEvent(next),
        durationMinutes: getDurationMinutes(current, next),
      });
    }
  }

  const lastEvent = events[events.length - 1];
  if (lastEvent?.EventType === "arv-dock") {
    const terminalEvent = toSegmentEvent(lastEvent);
    segments.push({
      id: `${lastEvent.Key}--terminal`,
      segmentIndex: segments.length,
      kind: "dock",
      isTerminal: true,
      startEvent: terminalEvent,
      endEvent: terminalEvent,
      durationMinutes: 0,
    });
  }

  return segments;
};

/**
 * Converts one merged boundary event into the timeline event shape consumed by
 * the render pipeline.
 *
 * @param event - Merged boundary event
 * @returns Segment event payload with display terminal name
 */
const toSegmentEvent = (
  event: MergedTimelineBoundaryEvent
): VesselTimelineSegmentEvent => ({
  Key: event.Key,
  ScheduledDeparture: event.ScheduledDeparture,
  TerminalAbbrev: event.TerminalAbbrev,
  EventType: event.EventType,
  TerminalDisplayName: getDisplayTerminalName(event.TerminalAbbrev),
  EventScheduledTime: event.EventScheduledTime,
  EventPredictedTime: event.EventPredictedTime,
  EventActualTime: event.EventActualTime,
});

/**
 * Builds the synthetic arrival placeholder segment used at the start of the
 * bounded service day or when a broken seam is encountered.
 *
 * @param departureEvent - Departure event missing a matching prior arrival
 * @param segmentIndex - Index of this segment in timeline order
 * @param eventIndex - Index of the departure event in the ordered event list
 * @returns Synthetic dock segment with explicit placeholder reason
 */
const buildArrivalPlaceholderSegment = (
  departureEvent: MergedTimelineBoundaryEvent,
  segmentIndex: number,
  eventIndex: number
): VesselTimelineSegment => ({
  id: `${departureEvent.Key}--arrival-placeholder--dock`,
  segmentIndex,
  kind: "dock",
  placeholderReason: eventIndex === 0 ? "start-of-day" : "broken-seam",
  startEvent: {
    Key: `${departureEvent.Key}--arrival-placeholder`,
    ScheduledDeparture: departureEvent.ScheduledDeparture,
    TerminalAbbrev: departureEvent.TerminalAbbrev,
    EventType: "arv-dock",
    TerminalDisplayName: getDisplayTerminalName(departureEvent.TerminalAbbrev),
    IsArrivalPlaceholder: true,
    EventScheduledTime: undefined,
    EventPredictedTime: undefined,
    EventActualTime: undefined,
  },
  endEvent: toSegmentEvent(departureEvent),
  durationMinutes: 0,
});

/**
 * True when the adjacent event pair forms a dock segment.
 *
 * @param current - Current event
 * @param next - Next event
 * @returns Whether the pair forms a dock segment
 */
const isDockPair = (
  current: MergedTimelineBoundaryEvent,
  next: MergedTimelineBoundaryEvent
) =>
  current.EventType === "arv-dock" &&
  next.EventType === "dep-dock" &&
  current.TerminalAbbrev === next.TerminalAbbrev;

/**
 * True when the adjacent event pair forms a sea segment.
 *
 * @param current - Current event
 * @param next - Next event
 * @returns Whether the pair forms a sea segment
 */
const isSeaPair = (
  current: MergedTimelineBoundaryEvent,
  next: MergedTimelineBoundaryEvent
) => current.EventType === "dep-dock" && next.EventType === "arv-dock";

/**
 * True when a synthetic arrival placeholder is required before a departure.
 *
 * @param previous - Previous event in sequence
 * @param current - Current event
 * @returns Whether an arrival placeholder should be inserted
 */
const needsArrivalPlaceholder = (
  previous: MergedTimelineBoundaryEvent | undefined,
  current: MergedTimelineBoundaryEvent
) =>
  current.EventType === "dep-dock" &&
  !(
    previous?.EventType === "arv-dock" &&
    previous.TerminalAbbrev === current.TerminalAbbrev
  );

/**
 * Returns a schedule-first duration between two boundary events.
 *
 * @param startEvent - Start boundary event
 * @param endEvent - End boundary event
 * @returns Positive duration in minutes, or `1` when unavailable
 */
const getDurationMinutes = (
  startEvent: MergedTimelineBoundaryEvent,
  endEvent: MergedTimelineBoundaryEvent
) => {
  const startTime = getLayoutTime(startEvent);
  const endTime = getLayoutTime(endEvent);

  if (!startTime || !endTime) {
    return 1;
  }

  const minutes = (endTime.getTime() - startTime.getTime()) / 60_000;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 1;
  }

  return Math.max(1, minutes);
};

/**
 * Returns the shortened display terminal name used by VesselTimeline.
 *
 * @param terminalAbbrev - Terminal abbreviation
 * @returns Short display name or `undefined`
 */
const getDisplayTerminalName = (terminalAbbrev?: string) => {
  if (!terminalAbbrev) {
    return undefined;
  }

  const terminalName = getTerminalNameByAbbrev(terminalAbbrev);
  if (!terminalName) {
    return terminalAbbrev;
  }

  return terminalName.replace(/Island\b/, "Is.").trim();
};
