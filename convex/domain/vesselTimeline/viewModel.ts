/**
 * Builds the backend-owned VesselTimeline row and view-model read model.
 */

import type { ConvexActualBoundaryEvent } from "../../functions/eventsActual/schemas";
import type { ConvexPredictedBoundaryEvent } from "../../functions/eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "../../functions/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";
import type {
  ConvexVesselTimelineRow,
  ConvexVesselTimelineRowEvent,
  ConvexVesselTimelineViewModel,
} from "../../functions/vesselTimeline/schemas";
import type { ConvexVesselTrip } from "../../functions/vesselTrips/schemas";
import type { BoundaryEventType } from "../../shared/keys";

const BOUNDARY_KEY_SUFFIX_PATTERN = /--(?:dep|arv)-dock$/;

type MergedTimelineBoundaryEvent = {
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

type BuildVesselTimelineRowsArgs = {
  mergedEvents: MergedTimelineBoundaryEvent[];
  terminalTailTripKey?: string | null;
};

type BuildVesselTimelineViewModelArgs = {
  VesselAbbrev: string;
  SailingDay: string;
  scheduledEvents: ConvexScheduledBoundaryEvent[];
  actualEvents: ConvexActualBoundaryEvent[];
  predictedEvents: ConvexPredictedBoundaryEvent[];
  location: ConvexVesselLocation | null;
  activeTrip: ConvexVesselTrip | null;
  inferredDockedTripKey?: string | null;
  terminalTailTripKey?: string | null;
};

/**
 * Builds the full backend-owned timeline view model for one vessel/day.
 *
 * @param args - Read-model inputs loaded by the query layer
 * @returns Query-ready VesselTimeline view model
 */
export const buildVesselTimelineViewModel = ({
  VesselAbbrev,
  SailingDay,
  scheduledEvents,
  actualEvents,
  predictedEvents,
  location,
  activeTrip,
  inferredDockedTripKey,
  terminalTailTripKey,
}: BuildVesselTimelineViewModelArgs): ConvexVesselTimelineViewModel => {
  const mergedEvents = mergeBoundaryEvents({
    scheduledEvents,
    actualEvents,
    predictedEvents,
  });
  const rows = buildVesselTimelineRows({
    mergedEvents,
    terminalTailTripKey,
  });
  const activeRowId = resolveActiveRowId({
    rows,
    location,
    activeTrip,
    inferredDockedTripKey,
  });
  const live = location ? toTimelineLiveState(location) : null;

  return {
    VesselAbbrev,
    SailingDay,
    ObservedAt: location?.TimeStamp ?? activeTrip?.TimeStamp ?? null,
    rows,
    activeRowId,
    live,
  };
};

/**
 * Merges sparse actual and predicted overlays onto the scheduled backbone.
 *
 * @param args - Boundary-event tables for one vessel/day
 * @returns Ordered merged boundary events
 */
export const mergeBoundaryEvents = ({
  scheduledEvents,
  actualEvents,
  predictedEvents,
}: {
  scheduledEvents: ConvexScheduledBoundaryEvent[];
  actualEvents: ConvexActualBoundaryEvent[];
  predictedEvents: ConvexPredictedBoundaryEvent[];
}): MergedTimelineBoundaryEvent[] => {
  const actualByKey = new Map(actualEvents.map((event) => [event.Key, event]));
  const predictedByKey = new Map(
    predictedEvents.map((event) => [event.Key, event])
  );

  return [...scheduledEvents]
    .sort(sortScheduledBoundaryEvents)
    .map((event) => ({
      Key: event.Key,
      VesselAbbrev: event.VesselAbbrev,
      SailingDay: event.SailingDay,
      ScheduledDeparture: event.ScheduledDeparture,
      TerminalAbbrev: event.TerminalAbbrev,
      EventType: event.EventType,
      EventScheduledTime: event.EventScheduledTime,
      EventActualTime: actualByKey.get(event.Key)?.EventActualTime,
      EventPredictedTime: predictedByKey.get(event.Key)?.EventPredictedTime,
    }));
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
}: BuildVesselTimelineRowsArgs): ConvexVesselTimelineRow[] => {
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
    const dockRow = buildDockRow({
      tripKey,
      departureEvent: currentEvent,
      previousEvent,
    });
    rows.push(dockRow);

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
  if (
    lastEvent?.EventType === "arv-dock" &&
    terminalTailTripKey &&
    !rows.some(
      (row) => row.rowId === buildRowId(terminalTailTripKey, "at-dock")
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
 * Resolves the active row ID from live trip and location state.
 *
 * @param args - Rows plus authoritative live identity inputs
 * @returns Stable active row ID, or `null` when none can be resolved
 */
export const resolveActiveRowId = ({
  rows,
  location,
  activeTrip,
  inferredDockedTripKey,
}: {
  rows: ConvexVesselTimelineRow[];
  location: ConvexVesselLocation | null;
  activeTrip: ConvexVesselTrip | null;
  inferredDockedTripKey?: string | null;
}) => {
  const atDock = activeTrip?.AtDock ?? location?.AtDock;
  if (atDock === undefined) {
    return null;
  }

  const tripKey =
    activeTrip?.Key ??
    location?.Key ??
    (atDock ? (inferredDockedTripKey ?? undefined) : undefined);

  if (!tripKey) {
    return null;
  }

  const rowId = buildRowId(tripKey, atDock ? "at-dock" : "at-sea");
  return rows.some((row) => row.rowId === rowId) ? rowId : null;
};

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

  return {
    rowId: buildRowId(tripKey, "at-dock"),
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
 * Builds a stable row ID for one trip phase.
 *
 * @param tripKey - Stable trip key
 * @param kind - Row phase kind
 * @returns Stable row ID
 */
const buildRowId = (tripKey: string, kind: ConvexVesselTimelineRow["kind"]) =>
  `${tripKey}--${kind}`;

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

/**
 * Converts a live vessel-location row into the compact timeline live state.
 *
 * @param location - Current vessel location row
 * @returns Live-state payload for the timeline view model
 */
const toTimelineLiveState = (
  location: ConvexVesselLocation
): ConvexVesselTimelineViewModel["live"] => ({
  VesselName: location.VesselName,
  AtDock: location.AtDock,
  InService: location.InService,
  Speed: location.Speed,
  DepartingTerminalAbbrev: location.DepartingTerminalAbbrev,
  ArrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
  DepartingDistance: location.DepartingDistance,
  ArrivingDistance: location.ArrivingDistance,
  LeftDock: location.LeftDock,
  Eta: location.Eta,
  ScheduledDeparture: location.ScheduledDeparture,
  TimeStamp: location.TimeStamp,
});

/**
 * Sorts scheduled boundary events into stable timeline order.
 *
 * @param left - Left boundary event
 * @param right - Right boundary event
 * @returns Stable sort comparison result
 */
const sortScheduledBoundaryEvents = (
  left: ConvexScheduledBoundaryEvent,
  right: ConvexScheduledBoundaryEvent
) =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  getEventTypeOrder(left.EventType) - getEventTypeOrder(right.EventType) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

/**
 * Returns the stable sort rank for one boundary-event type.
 *
 * @param eventType - Boundary-event type
 * @returns Sort rank
 */
const getEventTypeOrder = (eventType: BoundaryEventType) =>
  eventType === "dep-dock" ? 0 : 1;
