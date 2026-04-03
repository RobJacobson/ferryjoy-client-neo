/**
 * Frontend row derivation from the event-first VesselTimeline contract.
 */

import type { VesselTimelineEvent } from "convex/functions/vesselTimeline/schemas";
import type { VesselTimelineRow, VesselTimelineRowEvent } from "../types";

/**
 * Builds presentation rows from ordered timeline events.
 *
 * @param events - Ordered event-first timeline payload
 * @returns Derived rows used by the shared renderer
 */
export const buildRowsFromEvents = (
  events: VesselTimelineEvent[]
): VesselTimelineRow[] => {
  const rows: VesselTimelineRow[] = [];
  const arrivalsBySegmentKey = new Map(
    events
      .filter((event) => event.EventType === "arv-dock")
      .map((event) => [event.SegmentKey, event] as const)
  );

  for (let index = 0; index < events.length; index++) {
    const currentEvent = events[index];
    if (!currentEvent || currentEvent.EventType !== "dep-dock") {
      continue;
    }

    const previousEvent = events[index - 1];

    rows.push(
      buildDockRow({
        segmentKey: currentEvent.SegmentKey,
        departureEvent: currentEvent,
        previousEvent,
      })
    );

    const arrivalEvent = arrivalsBySegmentKey.get(currentEvent.SegmentKey);
    if (arrivalEvent) {
      rows.push(
        buildSeaRow({
          segmentKey: currentEvent.SegmentKey,
          departureEvent: currentEvent,
          arrivalEvent,
        })
      );
    }
  }

  const lastEvent = events[events.length - 1];
  if (lastEvent?.EventType === "arv-dock") {
    rows.push(buildTerminalTailRow({ arrivalEvent: lastEvent }));
  }

  return rows;
};

const buildRowId = (segmentKey: string, kind: VesselTimelineRow["kind"]) =>
  `${segmentKey}--${kind}`;

const buildTerminalTailRowId = (segmentKey: string) =>
  `${buildRowId(segmentKey, "at-dock")}--terminal-tail`;

const buildDockRow = ({
  segmentKey,
  departureEvent,
  previousEvent,
}: {
  segmentKey: string;
  departureEvent: VesselTimelineEvent;
  previousEvent: VesselTimelineEvent | undefined;
}): VesselTimelineRow => {
  const matchedArrival =
    previousEvent?.EventType === "arv-dock" &&
    previousEvent.TerminalAbbrev === departureEvent.TerminalAbbrev
      ? previousEvent
      : undefined;
  const placeholderReason = matchedArrival
    ? undefined
    : previousEvent
      ? "broken-seam"
      : "start-of-day";
  const startEvent = matchedArrival
    ? toRowEvent(matchedArrival)
    : buildPlaceholderStartEvent(departureEvent);
  const endEvent = toRowEvent(departureEvent);

  return {
    rowId: buildRowId(segmentKey, "at-dock"),
    segmentKey,
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

const buildTerminalTailRow = ({
  arrivalEvent,
}: {
  arrivalEvent: VesselTimelineEvent;
}): VesselTimelineRow => {
  const event = toRowEvent(arrivalEvent);

  return {
    rowId: buildTerminalTailRowId(arrivalEvent.SegmentKey),
    segmentKey: arrivalEvent.SegmentKey,
    kind: "at-dock",
    rowEdge: "terminal-tail",
    placeholderReason: undefined,
    startEvent: event,
    endEvent: event,
    durationMinutes: 0,
  };
};

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

const getLayoutTime = (event: VesselTimelineRowEvent) =>
  event.EventScheduledTime ??
  event.EventActualTime ??
  event.EventPredictedTime ??
  event.ScheduledDeparture;

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
