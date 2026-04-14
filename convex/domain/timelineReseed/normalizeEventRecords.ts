/**
 * Normalizes and orders hydrated vessel timeline event records for reseed.
 */

import type {
  ConvexVesselTimelineEventRecord,
  VesselTimelineEventType,
} from "../../functions/vesselTimeline/schemas";
import { buildVesselSailingDayScopeKey } from "../../shared/keys";

const IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS = 5 * 60 * 1000;

/**
 * Sorts vessel trip events into stable timeline order.
 *
 * @param left - First event to compare
 * @param right - Second event to compare
 * @returns Negative when `left` should appear before `right`
 */
export const sortVesselTripEvents = (
  left: ConvexVesselTimelineEventRecord,
  right: ConvexVesselTimelineEventRecord
) =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  getEventTypeOrder(left.EventType) - getEventTypeOrder(right.EventType) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

/**
 * Normalizes a sorted vessel/day event list so identical scheduled arrival and
 * departure boundaries at the same terminal become a real five-minute dock
 * span instead of a zero-length seam.
 *
 * @param events - Sorted vessel/day boundary events
 * @returns Cloned event list with identical dock seams corrected
 */
export const normalizeScheduledDockSeams = (
  events: ConvexVesselTimelineEventRecord[]
): ConvexVesselTimelineEventRecord[] => {
  const adjustedScheduledTimesByKey = new Map<string, number>();
  const eventsByVesselDay = new Map<
    string,
    ConvexVesselTimelineEventRecord[]
  >();

  for (const event of events) {
    const vesselDayKey = buildVesselSailingDayScopeKey(
      event.VesselAbbrev,
      event.SailingDay
    );
    const scopedEvents = eventsByVesselDay.get(vesselDayKey);

    if (scopedEvents) {
      scopedEvents.push(event);
      continue;
    }

    eventsByVesselDay.set(vesselDayKey, [event]);
  }

  for (const scopedEvents of eventsByVesselDay.values()) {
    const sortedScopedEvents = [...scopedEvents].sort(sortVesselTripEvents);

    for (let index = 0; index < sortedScopedEvents.length; index++) {
      const event = sortedScopedEvents[index];
      if (
        event?.EventScheduledTime &&
        isIdenticalScheduledDockSeam(event, sortedScopedEvents[index + 1])
      ) {
        adjustedScheduledTimesByKey.set(
          event.Key,
          event.EventScheduledTime - IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS
        );
      }
    }
  }

  return events.map((event) => {
    const adjustedScheduledTime = adjustedScheduledTimesByKey.get(event.Key);

    return adjustedScheduledTime !== undefined
      ? {
          ...event,
          EventScheduledTime: adjustedScheduledTime,
        }
      : event;
  });
};

const isIdenticalScheduledDockSeam = (
  current: ConvexVesselTimelineEventRecord,
  next: ConvexVesselTimelineEventRecord | undefined
) =>
  next !== undefined &&
  current.EventType === "arv-dock" &&
  next.EventType === "dep-dock" &&
  current.TerminalAbbrev === next.TerminalAbbrev &&
  next.EventScheduledTime !== undefined &&
  current.EventScheduledTime === next.EventScheduledTime;

const getEventTypeOrder = (eventType: VesselTimelineEventType) =>
  eventType === "dep-dock" ? 0 : 1;
