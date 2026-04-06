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
  const predictedByKey = new Map(
    predictedEvents.map((event) => [event.Key, event])
  );

  return [...scheduledEvents]
    .sort(sortScheduledBoundaryEvents)
    .map((event) => ({
      SegmentKey: getSegmentKeyFromBoundaryKey(event.Key),
      Key: event.Key,
      VesselAbbrev: event.VesselAbbrev,
      SailingDay: event.SailingDay,
      ScheduledDeparture: event.ScheduledDeparture,
      TerminalAbbrev: event.TerminalAbbrev,
      EventType: event.EventType,
      EventScheduledTime: event.EventScheduledTime,
      EventPredictedTime: predictedByKey.get(event.Key)?.EventPredictedTime,
      EventOccurred:
        actualByKey.get(event.Key)?.EventOccurred ??
        (actualByKey.get(event.Key)?.EventActualTime !== undefined
          ? true
          : undefined),
      EventActualTime: actualByKey.get(event.Key)?.EventActualTime,
    }));
};
