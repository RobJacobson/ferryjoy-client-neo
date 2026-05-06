/**
 * Client-owned merge policy for vessel timeline event rows.
 *
 * `VesselTimeline` subscribes to raw Convex event tables and interprets those
 * rows locally. This module keeps exact actual attachment and prediction
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
 * raw row subscriptions. Actual rows attach by physical TripKey and boundary
 * type; schedule-backed TripKeys match scheduled segment keys.
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
  const actualByTripKeyAndType = new Map<string, ConvexActualDockEvent>();

  for (const actual of actualEvents) {
    const key = actualAttachmentKey(actual.TripKey, actual.EventType);
    if (!actualByTripKeyAndType.has(key)) {
      actualByTripKeyAndType.set(key, actual);
    }
  }

  const sortedScheduledEvents = [...scheduledEvents].sort(
    sortScheduledDockEvents
  );

  return sortedScheduledEvents.map((event) => {
    const actualRow = resolveActualForScheduledEvent({
      event,
      actualByTripKeyAndType,
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
 * Resolves the actual row that should attach to one scheduled boundary.
 *
 * @param args - Scheduled row plus precomputed exact actual map
 * @returns Matching actual row when one is available
 */
const resolveActualForScheduledEvent = ({
  event,
  actualByTripKeyAndType,
}: {
  event: ConvexScheduledDockEvent;
  actualByTripKeyAndType: Map<string, ConvexActualDockEvent>;
}) => {
  const segment = getSegmentKeyFromBoundaryKey(event.Key);
  return actualByTripKeyAndType.get(
    actualAttachmentKey(segment, event.EventType)
  );
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
 * Builds the exact actual-attachment key for a TripKey and event type.
 *
 * @param tripKey - Physical trip key
 * @param eventType - Boundary event type
 * @returns Composite map key for exact actual lookups
 */
const actualAttachmentKey = (
  tripKey: string,
  eventType: ConvexScheduledDockEvent["EventType"]
) => `${tripKey}|${eventType}`;

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
