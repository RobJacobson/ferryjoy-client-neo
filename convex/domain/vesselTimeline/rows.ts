/**
 * Builds backend-owned VesselTimeline rows from merged boundary events.
 */

import type {
  ConvexVesselTimelineRow,
  ConvexVesselTimelineRowEvent,
} from "../../functions/vesselTimeline/schemas";
import type { BoundaryEventType } from "../../shared/keys";

const BOUNDARY_KEY_SUFFIX_PATTERN = /--(?:dep|arv)-dock$/;

export type MergedTimelineBoundaryEvent = {
  Key: string;
  VesselAbbrev: string;
  SailingDay: string;
  ScheduledDeparture: number;
  TerminalAbbrev: string;
  EventType: BoundaryEventType;
  EventScheduledTime?: number;
  EventPredictedTime?: number;
  EventActualTime?: number;
};

/**
 * Builds backend-owned at-dock and at-sea rows from merged boundary events.
 *
 * @param args - Ordered merged events and optional terminal-tail trip key
 * @returns Stable timeline rows keyed by trip identity
 */
export const buildVesselTimelineRows = ({
  mergedEvents,
  terminalTailTripKey,
}: {
  mergedEvents: MergedTimelineBoundaryEvent[];
  terminalTailTripKey?: string | null;
}): ConvexVesselTimelineRow[] => {
  const rows: ConvexVesselTimelineRow[] = [];
  const arrivalsByTripKey = new Map(
    mergedEvents
      .filter((event) => event.EventType === "arv-dock")
      .map((event) => [getTripKeyFromBoundaryKey(event.Key), event] as const)
  );

  for (let index = 0; index < mergedEvents.length; index++) {
    const currentEvent = mergedEvents[index];
    if (!currentEvent || currentEvent.EventType !== "dep-dock") {
      continue;
    }

    const tripKey = getTripKeyFromBoundaryKey(currentEvent.Key);
    const previousEvent = mergedEvents[index - 1];
    rows.push(
      buildDockRow({
        tripKey,
        departureEvent: currentEvent,
        previousEvent,
      })
    );

    const arrivalEvent = arrivalsByTripKey.get(tripKey);
    if (arrivalEvent) {
      rows.push(
        buildSeaRow({
          tripKey,
          departureEvent: currentEvent,
          arrivalEvent,
        })
      );
    }
  }

  const lastEvent = mergedEvents[mergedEvents.length - 1];
  const lastArrivalTripKey =
    lastEvent?.EventType === "arv-dock"
      ? getTripKeyFromBoundaryKey(lastEvent.Key)
      : null;
  if (
    lastEvent?.EventType === "arv-dock" &&
    terminalTailTripKey &&
    !rows.some(
      (row) =>
        row.rowId === buildTerminalTailRowId(terminalTailTripKey, lastArrivalTripKey)
    )
  ) {
    rows.push(
      buildTerminalTailRow({
        tripKey: terminalTailTripKey,
        arrivalEvent: lastEvent,
      })
    );
  }

  return rows;
};

/**
 * Builds a stable row ID for one trip phase.
 *
 * @param tripKey - Stable trip key
 * @param kind - Row phase kind
 * @returns Stable row ID
 */
export const buildRowId = (
  tripKey: string,
  kind: ConvexVesselTimelineRow["kind"]
) => `${tripKey}--${kind}`;

/**
 * Builds a stable row id for terminal tails.
 *
 * When the terminal tail belongs to the same trip as the arrival event, it
 * needs its own suffix so it does not collide with that trip's earlier
 * pre-departure dock row.
 *
 * @param tripKey - Trip key attached to the terminal-tail row
 * @param arrivalTripKey - Trip key extracted from the final arrival event
 * @returns Stable terminal-tail row id
 */
const buildTerminalTailRowId = (
  tripKey: string,
  arrivalTripKey: string | null
) =>
  tripKey === arrivalTripKey
    ? `${buildRowId(tripKey, "at-dock")}--terminal-tail`
    : buildRowId(tripKey, "at-dock");

/**
 * Builds one at-dock row for a trip.
 *
 * @param args - Trip key plus departure boundary context
 * @returns Backend-owned at-dock row
 */
const buildDockRow = ({
  tripKey,
  departureEvent,
  previousEvent,
}: {
  tripKey: string;
  departureEvent: MergedTimelineBoundaryEvent;
  previousEvent: MergedTimelineBoundaryEvent | undefined;
}): ConvexVesselTimelineRow => {
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
    rowId: buildRowId(tripKey, "at-dock"),
    tripKey,
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
 * Builds one at-sea row for a trip.
 *
 * @param args - Trip key plus departure and arrival boundary events
 * @returns Backend-owned at-sea row
 */
const buildSeaRow = ({
  tripKey,
  departureEvent,
  arrivalEvent,
}: {
  tripKey: string;
  departureEvent: MergedTimelineBoundaryEvent;
  arrivalEvent: MergedTimelineBoundaryEvent;
}): ConvexVesselTimelineRow => {
  const startEvent = toRowEvent(departureEvent);
  const endEvent = toRowEvent(arrivalEvent);

  return {
    rowId: buildRowId(tripKey, "at-sea"),
    tripKey,
    kind: "at-sea",
    rowEdge: "normal",
    placeholderReason: undefined,
    startEvent,
    endEvent,
    durationMinutes: getDurationMinutes(startEvent, endEvent),
  };
};

/**
 * Builds the terminal-tail row when the slice ends on an arrival boundary.
 *
 * @param args - Next-trip key and final arrival event
 * @returns Backend-owned terminal-tail dock row
 */
const buildTerminalTailRow = ({
  tripKey,
  arrivalEvent,
}: {
  tripKey: string;
  arrivalEvent: MergedTimelineBoundaryEvent;
}): ConvexVesselTimelineRow => {
  const event = toRowEvent(arrivalEvent);
  const arrivalTripKey = getTripKeyFromBoundaryKey(arrivalEvent.Key);

  return {
    rowId: buildTerminalTailRowId(tripKey, arrivalTripKey),
    tripKey,
    kind: "at-dock",
    rowEdge: "terminal-tail",
    placeholderReason: undefined,
    startEvent: event,
    endEvent: event,
    durationMinutes: 0,
  };
};

/**
 * Converts a merged boundary event into a row-event payload.
 *
 * @param event - Merged scheduled/actual/predicted event
 * @returns Row event payload for the public view model
 */
const toRowEvent = (
  event: MergedTimelineBoundaryEvent
): ConvexVesselTimelineRowEvent => ({
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
 * Builds a synthetic arrival event for dock rows that lack a real start.
 *
 * @param departureEvent - Departure boundary that starts the dock row
 * @returns Synthetic arrival placeholder event
 */
const buildPlaceholderStartEvent = (
  departureEvent: MergedTimelineBoundaryEvent
): ConvexVesselTimelineRowEvent => ({
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
 * Extracts the trip key from a boundary-event key.
 *
 * @param boundaryKey - Boundary key ending in `--dep-dock` or `--arv-dock`
 * @returns Stable trip key
 */
const getTripKeyFromBoundaryKey = (boundaryKey: string) =>
  boundaryKey.replace(BOUNDARY_KEY_SUFFIX_PATTERN, "");

/**
 * Returns schedule-first layout time for row-duration calculations.
 *
 * @param event - Row event
 * @returns Preferred layout timestamp
 */
const getLayoutTime = (event: ConvexVesselTimelineRowEvent) =>
  event.EventScheduledTime ?? event.EventActualTime ?? event.EventPredictedTime;

/**
 * Computes a positive duration between two row events.
 *
 * @param startEvent - Row start event
 * @param endEvent - Row end event
 * @returns Duration in minutes, or `1` when unavailable
 */
const getDurationMinutes = (
  startEvent: ConvexVesselTimelineRowEvent,
  endEvent: ConvexVesselTimelineRowEvent
) => {
  const startTime = getLayoutTime(startEvent);
  const endTime = getLayoutTime(endEvent);

  if (startTime === undefined || endTime === undefined) {
    return 1;
  }

  const minutes = (endTime - startTime) / 60_000;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 1;
  }

  return Math.max(1, minutes);
};
