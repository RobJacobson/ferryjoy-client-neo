/**
 * Client-owned merge policy for vessel timeline event rows.
 *
 * `VesselTimeline` subscribes to raw Convex event tables and interprets those
 * rows locally. This module keeps the actual-attachment and prediction
 * precedence rules next to the render pipeline that consumes them.
 */

import type { ConvexActualDockEvent } from "convex/functions/events/eventsActual/schemas";
import type { ConvexPredictedDockEvent } from "convex/functions/events/eventsPredicted/schemas";
import type { ConvexScheduledDockEvent } from "convex/functions/events/eventsScheduled/schemas";

type VesselTimelineMergedEvent = {
  SegmentKey: string;
  Key: string;
  VesselAbbrev: string;
  SailingDay: string;
  ScheduledDeparture: number;
  TerminalAbbrev: string;
  EventType: "dep-dock" | "arv-dock";
  EventScheduledTime?: number;
  EventPredictedTime?: number;
  EventOccurred?: true;
  EventActualTime?: number;
};

/**
 * Merges raw event table rows into ordered vessel timeline boundary events.
 *
 * The client owns this interpretation because `VesselTimeline` renders from
 * raw row subscriptions. Actual rows attach by schedule segment and boundary
 * type, with bounded arrival fallbacks for legacy or partial evidence.
 *
 * @param args - Scheduled backbone rows plus actual and predicted overlays
 * @returns Ordered boundary events ready for dock-visit assembly
 */
const mergeEventRowsForVesselTimeline = ({
  scheduledEvents,
  actualEvents,
  predictedEvents,
}: {
  scheduledEvents: ConvexScheduledDockEvent[];
  actualEvents: ConvexActualDockEvent[];
  predictedEvents: ConvexPredictedDockEvent[];
}): VesselTimelineMergedEvent[] => {
  const actualByScheduleKeyAndType = new Map<string, ConvexActualDockEvent>();

  for (const actual of actualEvents) {
    if (!actual.ScheduleKey) {
      continue;
    }

    const key = scheduleAttachmentKey(actual.ScheduleKey, actual.EventType);
    if (!actualByScheduleKeyAndType.has(key)) {
      actualByScheduleKeyAndType.set(key, actual);
    }
  }

  const sortedScheduledEvents = [...scheduledEvents].sort(
    sortScheduledDockEvents
  );
  const scheduleKeyedArrivalActuals = actualEvents
    .filter(
      (event): event is ConvexActualDockEvent & { EventActualTime: number } =>
        event.EventType === "arv-dock" &&
        event.EventActualTime !== undefined &&
        event.ScheduleKey !== undefined
    )
    .sort(
      (left, right) =>
        left.EventActualTime - right.EventActualTime ||
        left.ScheduledDeparture - right.ScheduledDeparture ||
        left.EventKey.localeCompare(right.EventKey)
    );
  const assignedArrivalActualByScheduledKey = new Map<
    string,
    ConvexActualDockEvent
  >();
  const usedActualArrivalEventKeys = new Set<string>();

  for (const event of sortedScheduledEvents) {
    if (event.EventType !== "arv-dock") {
      continue;
    }

    const segment = getSegmentKeyFromBoundaryKey(event.Key);
    const direct = actualByScheduleKeyAndType.get(
      scheduleAttachmentKey(segment, "arv-dock")
    );

    if (direct) {
      assignedArrivalActualByScheduledKey.set(event.Key, direct);
      usedActualArrivalEventKeys.add(direct.EventKey);
    }
  }

  for (const event of sortedScheduledEvents) {
    if (
      event.EventType !== "arv-dock" ||
      assignedArrivalActualByScheduledKey.has(event.Key)
    ) {
      continue;
    }

    const anchored = scheduleKeyedArrivalActuals.find(
      (actual) =>
        !usedActualArrivalEventKeys.has(actual.EventKey) &&
        actual.TerminalAbbrev === event.TerminalAbbrev &&
        actual.ScheduledDeparture === event.ScheduledDeparture
    );

    if (anchored) {
      assignedArrivalActualByScheduledKey.set(event.Key, anchored);
      usedActualArrivalEventKeys.add(anchored.EventKey);
    }
  }

  const scheduledArrivalEventsByTerminal = groupScheduledArrivalsByTerminal(
    sortedScheduledEvents
  );

  for (const [
    terminalAbbrev,
    terminalArrivalEvents,
  ] of scheduledArrivalEventsByTerminal) {
    let previousAssignedArrivalActualTime: number | undefined;

    for (let index = 0; index < terminalArrivalEvents.length; index += 1) {
      const event = terminalArrivalEvents[index];
      const existing = assignedArrivalActualByScheduledKey.get(event.Key);

      if (existing?.EventActualTime !== undefined) {
        previousAssignedArrivalActualTime = existing.EventActualTime;
        continue;
      }

      const candidate = scheduleKeyedArrivalActuals.find(
        (actual) =>
          !usedActualArrivalEventKeys.has(actual.EventKey) &&
          actual.TerminalAbbrev === terminalAbbrev &&
          (previousAssignedArrivalActualTime === undefined ||
            actual.EventActualTime > previousAssignedArrivalActualTime)
      );

      if (!candidate) {
        continue;
      }

      const nextEquivalentArrival = terminalArrivalEvents[index + 1];
      if (
        nextEquivalentArrival &&
        candidate.EventActualTime > getBoundaryTime(nextEquivalentArrival)
      ) {
        continue;
      }

      assignedArrivalActualByScheduledKey.set(event.Key, candidate);
      usedActualArrivalEventKeys.add(candidate.EventKey);
      previousAssignedArrivalActualTime = candidate.EventActualTime;
    }
  }

  return sortedScheduledEvents.map((event) => {
    const actualRow = resolveActualForScheduledEvent({
      event,
      actualByScheduleKeyAndType,
      assignedArrivalActualByScheduledKey,
    });

    return {
      SegmentKey: getSegmentKeyFromBoundaryKey(event.Key),
      Key: event.Key,
      VesselAbbrev: event.VesselAbbrev,
      SailingDay: event.SailingDay,
      ScheduledDeparture: event.ScheduledDeparture,
      TerminalAbbrev: event.TerminalAbbrev,
      EventType: event.EventType,
      EventScheduledTime: event.EventScheduledTime,
      EventPredictedTime: pickPredictedTimeForKey(event.Key, predictedEvents),
      EventOccurred:
        actualRow?.EventOccurred ??
        (actualRow?.EventActualTime !== undefined ? true : undefined),
      EventActualTime: actualRow?.EventActualTime,
    };
  });
};

/**
 * Groups scheduled arrival rows by terminal in existing timeline order.
 *
 * @param events - Sorted scheduled boundary rows
 * @returns Arrival rows keyed by terminal abbreviation
 */
const groupScheduledArrivalsByTerminal = (
  events: ConvexScheduledDockEvent[]
) => {
  const scheduledArrivalEventsByTerminal = new Map<
    string,
    ConvexScheduledDockEvent[]
  >();

  for (const event of events) {
    if (event.EventType !== "arv-dock") {
      continue;
    }

    const terminalEvents =
      scheduledArrivalEventsByTerminal.get(event.TerminalAbbrev) ?? [];
    terminalEvents.push(event);
    scheduledArrivalEventsByTerminal.set(event.TerminalAbbrev, terminalEvents);
  }

  return scheduledArrivalEventsByTerminal;
};

/**
 * Resolves the actual row that should attach to one scheduled boundary.
 *
 * @param args - Scheduled row plus precomputed exact and fallback actual maps
 * @returns Matching actual row when one is available
 */
const resolveActualForScheduledEvent = ({
  event,
  actualByScheduleKeyAndType,
  assignedArrivalActualByScheduledKey,
}: {
  event: ConvexScheduledDockEvent;
  actualByScheduleKeyAndType: Map<string, ConvexActualDockEvent>;
  assignedArrivalActualByScheduledKey: Map<string, ConvexActualDockEvent>;
}) => {
  const segment = getSegmentKeyFromBoundaryKey(event.Key);
  const exact = actualByScheduleKeyAndType.get(
    scheduleAttachmentKey(segment, event.EventType)
  );

  if (exact) {
    return exact;
  }

  return event.EventType === "arv-dock"
    ? assignedArrivalActualByScheduledKey.get(event.Key)
    : undefined;
};

/**
 * Chooses one display prediction for a scheduled boundary.
 *
 * @param key - Scheduled boundary key
 * @param predictedEvents - Candidate prediction rows
 * @returns Preferred predicted time, if available
 */
const pickPredictedTimeForKey = (
  key: string,
  predictedEvents: ConvexPredictedDockEvent[]
) => {
  const candidates = predictedEvents.filter((event) => event.Key === key);

  if (candidates.length === 0) {
    return undefined;
  }

  const wsf = candidates.find((event) => event.PredictionSource === "wsf_eta");
  if (wsf) {
    return wsf.EventPredictedTime;
  }

  const seaMl = candidates.find(
    (event) =>
      event.PredictionSource === "ml" &&
      event.PredictionType === "AtSeaArriveNext"
  );
  if (seaMl) {
    return seaMl.EventPredictedTime;
  }

  const dockMl = candidates.find(
    (event) =>
      event.PredictionSource === "ml" &&
      event.PredictionType === "AtDockArriveNext"
  );

  return dockMl?.EventPredictedTime ?? candidates[0]?.EventPredictedTime;
};

/**
 * Builds the exact actual-attachment key for a scheduled segment and event
 * type.
 *
 * @param scheduleSegment - Scheduled segment key without boundary suffix
 * @param eventType - Boundary event type
 * @returns Composite map key for exact actual lookups
 */
const scheduleAttachmentKey = (
  scheduleSegment: string,
  eventType: ConvexScheduledDockEvent["EventType"]
) => `${scheduleSegment}|${eventType}`;

/**
 * Orders scheduled rows in the client timeline sequence.
 *
 * @param left - Left scheduled row
 * @param right - Right scheduled row
 * @returns Stable comparison result
 */
const sortScheduledDockEvents = (
  left: ConvexScheduledDockEvent,
  right: ConvexScheduledDockEvent
) =>
  getBoundaryTime(left) - getBoundaryTime(right) ||
  getEventTypeOrder(left.EventType) - getEventTypeOrder(right.EventType) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

/**
 * Gets the timestamp used for scheduled boundary ordering.
 *
 * @param event - Scheduled row with optional explicit event time
 * @returns Event time when present, otherwise segment departure time
 */
const getBoundaryTime = (
  event: Pick<
    ConvexScheduledDockEvent,
    "EventScheduledTime" | "ScheduledDeparture"
  >
) => event.EventScheduledTime ?? event.ScheduledDeparture;

/**
 * Removes the dock-boundary suffix from a boundary key.
 *
 * @param boundaryKey - Boundary key ending in `--dep-dock` or `--arv-dock`
 * @returns Scheduled segment key
 */
const getSegmentKeyFromBoundaryKey = (boundaryKey: string) =>
  boundaryKey.replace(/--(?:dep|arv)-dock$/, "");

/**
 * Maps a dock event type to its scheduled-row sort rank.
 *
 * @param eventType - Boundary event type
 * @returns Sort rank with arrivals before departures
 */
const getEventTypeOrder = (eventType: ConvexScheduledDockEvent["EventType"]) =>
  eventType === "arv-dock" ? 0 : 1;

export type { VesselTimelineMergedEvent };
export { getSegmentKeyFromBoundaryKey, mergeEventRowsForVesselTimeline };
