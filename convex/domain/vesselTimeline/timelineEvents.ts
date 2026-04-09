/**
 * Builds the event-first VesselTimeline read backbone from normalized tables.
 */

import type { ConvexActualBoundaryEvent } from "../../functions/eventsActual/schemas";
import type { ConvexPredictedBoundaryEvent } from "../../functions/eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "../../functions/eventsScheduled/schemas";
import {
  getSegmentKeyFromBoundaryKey,
  sortScheduledBoundaryEvents,
} from "../../functions/eventsScheduled/segmentResolvers";
import type { ConvexVesselTimelineEvent } from "../../functions/vesselTimeline/schemas";

/**
 * Merges sparse actual and predicted overlays onto the scheduled event
 * backbone for one vessel/day.
 *
 * @param args - Normalized event tables for the current vessel/day scope
 * @returns Ordered timeline events for the public event-first API
 */
export const mergeTimelineEvents = ({
  scheduledEvents,
  actualEvents,
  predictedEvents,
}: {
  scheduledEvents: ConvexScheduledBoundaryEvent[];
  actualEvents: ConvexActualBoundaryEvent[];
  predictedEvents: ConvexPredictedBoundaryEvent[];
}): ConvexVesselTimelineEvent[] => {
  const actualByKey = new Map(actualEvents.map((event) => [event.Key, event]));

  /**
   * When an actual row was stored under a stale/orphan boundary `Key`, match it
   * to the scheduled arrival by terminal + scheduled departure anchor.
   */
  const resolveActualForScheduledEvent = (
    event: ConvexScheduledBoundaryEvent
  ) => {
    const direct = actualByKey.get(event.Key);
    if (direct) {
      return direct;
    }
    if (event.EventType !== "arv-dock") {
      return undefined;
    }
    return actualEvents.find(
      (a) =>
        a.EventActualTime !== undefined &&
        a.TerminalAbbrev === event.TerminalAbbrev &&
        a.ScheduledDeparture === event.ScheduledDeparture
    );
  };

  /**
   * Multiple `eventsPredicted` rows may share one boundary `Key` (WSF vs ML).
   * Backbone uses WSF when present, else ML with legacy precedence
   * (AtSeaArriveNext before AtDockArriveNext).
   */
  const pickPredictedTimeForKey = (key: string) => {
    const candidates = predictedEvents.filter((e) => e.Key === key);
    if (candidates.length === 0) {
      return undefined;
    }
    const wsf = candidates.find((e) => e.PredictionSource === "wsf_eta");
    if (wsf) {
      return wsf.EventPredictedTime;
    }
    const seaMl = candidates.find(
      (e) =>
        e.PredictionSource === "ml" && e.PredictionType === "AtSeaArriveNext"
    );
    if (seaMl) {
      return seaMl.EventPredictedTime;
    }
    const dockMl = candidates.find(
      (e) =>
        e.PredictionSource === "ml" && e.PredictionType === "AtDockArriveNext"
    );
    return dockMl?.EventPredictedTime ?? candidates[0]?.EventPredictedTime;
  };

  return [...scheduledEvents].sort(sortScheduledBoundaryEvents).map((event) => {
    const actualRow = resolveActualForScheduledEvent(event);
    return {
      SegmentKey: getSegmentKeyFromBoundaryKey(event.Key),
      Key: event.Key,
      VesselAbbrev: event.VesselAbbrev,
      SailingDay: event.SailingDay,
      ScheduledDeparture: event.ScheduledDeparture,
      TerminalAbbrev: event.TerminalAbbrev,
      EventType: event.EventType,
      EventScheduledTime: event.EventScheduledTime,
      EventPredictedTime: pickPredictedTimeForKey(event.Key),
      EventOccurred:
        actualRow?.EventOccurred ??
        (actualRow?.EventActualTime !== undefined ? true : undefined),
      EventActualTime: actualRow?.EventActualTime,
    };
  });
};
