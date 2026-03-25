/**
 * Merge logic for reseeding schedule-derived vessel trip events without
 * discarding live historical state.
 */
import type { ConvexVesselTripEvent } from "../../../functions/vesselTripEvents/schemas";
import { sortVesselTripEvents } from "./liveUpdates";

type MergeSeededVesselTripEventsArgs = {
  existingEvents: ConvexVesselTripEvent[];
  seededEvents: ConvexVesselTripEvent[];
  nowTimestamp: number;
};

/**
 * Merges fresh schedule seed data into the mutable vessel/day read model.
 * Future events remain schedule-owned, while present and historical events
 * stay history-owned.
 *
 * @param args - Existing read-model rows, fresh seed rows, and the current time
 * @returns Sorted event rows that should exist after reseeding
 */
export const mergeSeededVesselTripEvents = ({
  existingEvents,
  seededEvents,
  nowTimestamp,
}: MergeSeededVesselTripEventsArgs): ConvexVesselTripEvent[] => {
  const existingById = new Map(
    existingEvents.map((event) => [event.Key, event])
  );
  const mergedEvents: ConvexVesselTripEvent[] = [];

  for (const seededEvent of seededEvents) {
    const existingEvent = existingById.get(seededEvent.Key);
    existingById.delete(seededEvent.Key);

    if (!existingEvent) {
      // Newly seeded past/present rows are ignored so live/history remains the
      // authority once an event has entered the present.
      if (isHistoryOwnedEvent(seededEvent, nowTimestamp)) {
        continue;
      }

      mergedEvents.push(seededEvent);
      continue;
    }

    if (isHistoryOwnedEvent(existingEvent, nowTimestamp)) {
      mergedEvents.push(existingEvent);
      continue;
    }

    // Future rows stay schedule-owned, but retain any live prediction state
    // already attached to the logical event.
    mergedEvents.push({
      ...seededEvent,
      PredictedTime: existingEvent.PredictedTime,
      ActualTime: existingEvent.ActualTime,
    });
  }

  for (const existingEvent of existingById.values()) {
    // Rows missing from the fresh seed survive only after they become
    // history-owned; obsolete future rows can disappear.
    if (isHistoryOwnedEvent(existingEvent, nowTimestamp)) {
      mergedEvents.push(existingEvent);
    }
  }

  return mergedEvents.sort(sortVesselTripEvents);
};

/**
 * Determines whether an event should be preserved as live/history-owned during
 * schedule reseeding.
 *
 * @param event - Event row under consideration
 * @param nowTimestamp - Current time in epoch milliseconds
 * @returns True when the event should no longer be replaced by schedule data
 */
const isHistoryOwnedEvent = (
  event: ConvexVesselTripEvent,
  nowTimestamp: number
) => {
  if (event.ActualTime !== undefined) {
    return true;
  }

  // Predictions can pull an event into the present earlier than the scheduled
  // fallback, so use the best known effective timestamp.
  const eventTimestamp =
    event.PredictedTime ?? event.ScheduledTime ?? event.ScheduledDeparture;

  return eventTimestamp <= nowTimestamp;
};
