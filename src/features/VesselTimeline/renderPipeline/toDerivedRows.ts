/**
 * Pipeline stage: derive feature-owned rows from ordered VesselTimeline events.
 */

import type { VesselTimelineEvent } from "convex/functions/vesselTimeline/schemas";
import { buildAdjacentTimelineIntervals } from "shared/timelineIntervals";
import type { VesselTimelineRow, VesselTimelineRowEvent } from "../types";
import type {
  VesselTimelinePipelineInput,
  VesselTimelinePipelineWithRows,
} from "./pipelineTypes";

/**
 * Adds derived rows to the VesselTimeline render pipeline.
 *
 * @param input - Pipeline input containing ordered backend events
 * @returns Pipeline context enriched with derived rows
 */
export const toDerivedRows = (
  input: VesselTimelinePipelineInput
): VesselTimelinePipelineWithRows => ({
  ...input,
  rows: deriveRows(input.events),
});

/**
 * Builds feature-owned presentation rows from ordered timeline events.
 *
 * @param events - Ordered backend timeline events
 * @returns Derived rows used by later render-state stages
 */
const deriveRows = (events: VesselTimelineEvent[]): VesselTimelineRow[] => {
  const eventByKey = new Map(events.map((event) => [event.Key, event]));
  const intervals = buildAdjacentTimelineIntervals(events);

  return intervals.flatMap((interval) => {
    if (interval.kind === "at-sea") {
      const departureEvent = eventByKey.get(interval.startEventKey);
      const arrivalEvent = eventByKey.get(interval.endEventKey);

      return departureEvent && arrivalEvent
        ? [
            buildSeaRow({
              segmentKey: interval.segmentKey,
              departureEvent,
              arrivalEvent,
            }),
          ]
        : [];
    }

    if (interval.endEventKey === null) {
      const arrivalEvent = interval.startEventKey
        ? eventByKey.get(interval.startEventKey)
        : undefined;

      return arrivalEvent
        ? [
            buildTerminalTailRow({
              segmentKey: interval.previousSegmentKey,
              arrivalEvent,
            }),
          ]
        : [];
    }

    const departureEvent = eventByKey.get(interval.endEventKey);
    if (!departureEvent) {
      return [];
    }

    const arrivalEvent = interval.startEventKey
      ? eventByKey.get(interval.startEventKey)
      : undefined;

    return [
      buildDockRow({
        segmentKey: interval.nextSegmentKey,
        departureEvent,
        arrivalEvent,
      }),
    ];
  });
};

/**
 * Builds the stable row id for one segment and row kind.
 *
 * @param segmentKey - Segment identifier from the backend event payload
 * @param kind - Derived row kind
 * @returns Stable row identifier
 */
const buildRowId = (segmentKey: string, kind: VesselTimelineRow["kind"]) =>
  `${segmentKey}--${kind}`;

/**
 * Builds the stable row id for the terminal-tail dock row.
 *
 * @param segmentKey - Segment identifier from the backend event payload
 * @returns Terminal-tail row identifier
 */
const buildTerminalTailRowId = (segmentKey: string) =>
  `${buildRowId(segmentKey, "at-dock")}--terminal-tail`;

/**
 * Builds an at-dock row from the previous arrival and current departure.
 *
 * @param args - Dock-row inputs
 * @param args.segmentKey - Segment identifier
 * @param args.departureEvent - Current departure event
 * @param args.arrivalEvent - Previous adjacent arrival event, if any
 * @returns Derived at-dock row
 */
const buildDockRow = ({
  segmentKey,
  departureEvent,
  arrivalEvent,
}: {
  segmentKey: string | null;
  departureEvent: VesselTimelineEvent;
  arrivalEvent: VesselTimelineEvent | undefined;
}): VesselTimelineRow => {
  const startEvent = arrivalEvent
    ? toRowEvent(arrivalEvent)
    : buildPlaceholderStartEvent(departureEvent);
  const endEvent = toRowEvent(departureEvent);
  const placeholderReason = arrivalEvent ? undefined : "start-of-day";
  const resolvedSegmentKey = segmentKey ?? departureEvent.SegmentKey;

  return {
    rowId: buildRowId(resolvedSegmentKey, "at-dock"),
    segmentKey: resolvedSegmentKey,
    kind: "at-dock",
    rowEdge: "normal",
    placeholderReason,
    startEvent,
    endEvent,
    durationMinutes:
      placeholderReason === undefined
        ? getDurationMinutes(startEvent, endEvent)
        : 0,
  };
};

/**
 * Builds an at-sea row from a departure and its paired arrival.
 *
 * @param args - Sea-row inputs
 * @param args.segmentKey - Segment identifier
 * @param args.departureEvent - Current departure event
 * @param args.arrivalEvent - Paired arrival event
 * @returns Derived at-sea row
 */
const buildSeaRow = ({
  segmentKey,
  departureEvent,
  arrivalEvent,
}: {
  segmentKey: string;
  departureEvent: VesselTimelineEvent;
  arrivalEvent: VesselTimelineEvent;
}): VesselTimelineRow => {
  const startEvent = toRowEvent(departureEvent);
  const endEvent = toRowEvent(arrivalEvent);

  return {
    rowId: buildRowId(segmentKey, "at-sea"),
    segmentKey,
    kind: "at-sea",
    rowEdge: "normal",
    placeholderReason: undefined,
    startEvent,
    endEvent,
    durationMinutes: getDurationMinutes(startEvent, endEvent),
  };
};

/**
 * Builds the final terminal-tail row after the last arrival of the day.
 *
 * @param args - Terminal-tail inputs
 * @param args.arrivalEvent - Final arrival event for the day
 * @returns Derived terminal-tail dock row
 */
const buildTerminalTailRow = ({
  segmentKey,
  arrivalEvent,
}: {
  segmentKey: string | null;
  arrivalEvent: VesselTimelineEvent;
}): VesselTimelineRow => {
  const event = toRowEvent(arrivalEvent);
  const resolvedSegmentKey = segmentKey ?? arrivalEvent.SegmentKey;

  return {
    rowId: buildTerminalTailRowId(resolvedSegmentKey),
    segmentKey: resolvedSegmentKey,
    kind: "at-dock",
    rowEdge: "terminal-tail",
    placeholderReason: undefined,
    startEvent: event,
    endEvent: event,
    durationMinutes: 0,
  };
};

/**
 * Converts one backend event into the feature-owned row event shape.
 *
 * @param event - Backend timeline event
 * @returns Feature-owned row event
 */
const toRowEvent = (event: VesselTimelineEvent): VesselTimelineRowEvent => ({
  Key: event.Key,
  ScheduledDeparture: event.ScheduledDeparture,
  TerminalAbbrev: event.TerminalAbbrev,
  EventType: event.EventType,
  IsArrivalPlaceholder: undefined,
  EventScheduledTime: event.EventScheduledTime,
  EventPredictedTime: event.EventPredictedTime,
  EventActualTime: event.EventActualTime,
});

/**
 * Builds the placeholder arrival event used for the opening dock interval.
 *
 * @param departureEvent - Departure event that owns the placeholder
 * @returns Placeholder arrival row event
 */
const buildPlaceholderStartEvent = (
  departureEvent: VesselTimelineEvent
): VesselTimelineRowEvent => ({
  Key: `${departureEvent.Key}--arrival-placeholder`,
  ScheduledDeparture: departureEvent.ScheduledDeparture,
  TerminalAbbrev: departureEvent.TerminalAbbrev,
  EventType: "arv-dock",
  IsArrivalPlaceholder: true,
  EventScheduledTime: undefined,
  EventPredictedTime: undefined,
  EventActualTime: undefined,
});

/**
 * Returns the best available time for row geometry calculations.
 *
 * @param event - Feature-owned row event
 * @returns Schedule-first layout time for the row event
 */
const getLayoutTime = (event: VesselTimelineRowEvent) =>
  event.EventScheduledTime ??
  event.EventActualTime ??
  event.EventPredictedTime ??
  event.ScheduledDeparture;

/**
 * Calculates schedule-first duration minutes for a derived row.
 *
 * @param startEvent - Row start event
 * @param endEvent - Row end event
 * @returns Non-negative duration in minutes
 */
const getDurationMinutes = (
  startEvent: VesselTimelineRowEvent,
  endEvent: VesselTimelineRowEvent
) => {
  const startTime = getLayoutTime(startEvent);
  const endTime = getLayoutTime(endEvent);

  if (endTime < startTime) {
    return 0;
  }

  return Math.round((endTime.getTime() - startTime.getTime()) / 60_000);
};
