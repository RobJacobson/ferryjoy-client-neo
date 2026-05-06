/**
 * Aligns scheduled boundary rows with stored actual rows for one slice.
 *
 * Sorts scheduled rows for deterministic pairing, then indexes actual rows by
 * physical TripKey plus event type. The output is the neutral boundary-event
 * row that downstream confirmation gates use.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ScheduledBoundaryContext } from "../../common/types";
import {
  getSegmentKeyFromBoundaryKey,
  sortScheduledDockEvents,
} from "../../scheduled/scheduledSegmentResolvers";
import type { LocationReconcileBoundaryEvent } from "./types";

/**
 * Aligns scheduled boundaries with stored actual rows for one vessels slice.
 *
 * Sorts scheduled rows for deterministic pairing, then indexes actual rows by
 * TripKey plus event type so schedule-backed rows attach to their current
 * physical boundary without storing schedule linkage on eventsActual.
 *
 * @param args.scheduledEvents - Planned dock boundaries for one vessel and sailing day
 * @param args.actualEvents - Existing actual rows considered for matching
 * @returns Boundary rows enriched with current EventOccurred and EventActualTime
 */
const buildLocationReconcileBoundaryEvents = ({
  scheduledEvents,
  actualEvents,
}: {
  scheduledEvents: ScheduledBoundaryContext[];
  actualEvents: ConvexActualDockEvent[];
}): LocationReconcileBoundaryEvent[] => {
  const sortedScheduledEvents = [...scheduledEvents].sort(
    sortScheduledDockEvents
  );
  const exactActualByTripKey = buildExactActualLookup(actualEvents);

  return sortedScheduledEvents.map((event) => {
    const actualRow = exactActualByTripKey.get(scheduledActualLookupKey(event));

    return {
      SegmentKey: getSegmentKeyFromBoundaryKey(event.Key),
      Key: event.Key,
      VesselAbbrev: event.VesselAbbrev,
      SailingDay: event.SailingDay,
      ScheduledDeparture: event.ScheduledDeparture,
      TerminalAbbrev: event.TerminalAbbrev,
      EventType: event.EventType,
      EventScheduledTime: event.EventScheduledTime,
      EventOccurred:
        actualRow?.EventOccurred ??
        (actualRow?.EventActualTime !== undefined ? true : undefined),
      EventActualTime: actualRow?.EventActualTime,
    };
  });
};

/**
 * Indexes actual rows that align cleanly with TripKey plus event type.
 *
 * Keeps the first seen row per composite key so reconcile prefers stable
 * physical identity when multiple candidates are present.
 *
 * @param actualEvents - Persisted actual dock rows for the reload slice
 * @returns Map from segment-plus-type key to representative actual row
 */
const buildExactActualLookup = (actualEvents: ConvexActualDockEvent[]) => {
  const actualByTripKeyAndType = new Map<string, ConvexActualDockEvent>();

  for (const actual of actualEvents) {
    const key = actualLookupKey(actual.TripKey, actual.EventType);
    if (!actualByTripKeyAndType.has(key)) {
      actualByTripKeyAndType.set(key, actual);
    }
  }

  return actualByTripKeyAndType;
};

/**
 * Builds the segment-plus-type lookup key used for scheduled boundary rows.
 *
 * @param event - Scheduled dock boundary whose Key encodes segment suffix
 * @returns Composite key shared with actualLookupKey for schedule-aligned joins
 */
const scheduledActualLookupKey = (event: ScheduledBoundaryContext) =>
  actualLookupKey(getSegmentKeyFromBoundaryKey(event.Key), event.EventType);

/**
 * Concatenates segment identity with event type for Map lookups.
 *
 * @param scheduleSegment - Segment string from the scheduled boundary Key
 * @param eventType - dep-dock or arv-dock discriminator
 * @returns Stable string key for exact actual row indexing
 */
const actualLookupKey = (
  scheduleSegment: string,
  eventType: ScheduledBoundaryContext["EventType"]
) => `${scheduleSegment}|${eventType}`;

export { buildLocationReconcileBoundaryEvents };
