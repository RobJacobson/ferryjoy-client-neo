/**
 * Builds persisted actual dock-event rows from boundary records and writes.
 *
 * These pure helpers normalize schedule-backed and physical-only actual
 * evidence into the eventsActual table shape.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import { buildPhysicalActualEventKey } from "../../../shared/physicalTripIdentity";
import { getSailingDay } from "../../../shared/time";
import type { DockBoundaryEventRecord } from "../types";
import type { TripContextForActualRow } from "./bindActualRowsToTrips";
import type { ConvexActualDockWritePersistable } from "./schemas";

/**
 * Builds normalized actual dock rows from in-memory boundary event records.
 *
 * Reload and hydration produce DockBoundaryEventRecord lists that already
 * carry SegmentKey and optional actual times. This step resolves TripKey from
 * tripBySegmentKey so physical EventKey values match the rest of the vessel
 * pipeline. Records still missing TripKey after lookup are skipped because
 * eventsActual rows require physical identity.
 *
 * @param events - Event records for one vessel/day slice
 * @param updatedAt - Timestamp to stamp onto rows that are inserted or updated
 * @param tripBySegmentKey - Schedule segment key to physical trip context
 * @returns Actual dock rows for events that have evidence of occurrence and resolvable TripKey
 */
const buildActualDockEvents = (
  events: DockBoundaryEventRecord[],
  updatedAt: number,
  tripBySegmentKey: Map<string, TripContextForActualRow>
): ConvexActualDockEvent[] =>
  events
    .filter(
      (event) =>
        event.EventOccurred === true || event.EventActualTime !== undefined
    )
    .flatMap((event) => {
      const trip = tripBySegmentKey.get(event.SegmentKey);
      if (!trip?.TripKey) {
        return [];
      }

      const eventKey = buildPhysicalActualEventKey(
        trip.TripKey,
        event.EventType
      );

      return [
        {
          EventKey: eventKey,
          TripKey: trip.TripKey,
          EventType: event.EventType,
          VesselAbbrev: event.VesselAbbrev,
          SailingDay: event.SailingDay,
          UpdatedAt: updatedAt,
          ScheduledDeparture: event.ScheduledDeparture,
          TerminalAbbrev: event.TerminalAbbrev,
          EventOccurred: true,
          EventActualTime: event.EventActualTime,
        },
      ];
    });

/**
 * Builds one normalized actual dock row from a sparse persistable write.
 *
 * Ingestion paths sometimes omit SailingDay or ScheduledDeparture when only a
 * clock event is known. This derives sailing day from anchor milliseconds and
 * fills scheduled departure so downstream equality and indexes stay stable.
 * EventKey defaults from TripKey and EventType when callers did not precompute it.
 *
 * @param write - Persistable write with TripKey and at least one of EventActualTime or ScheduledDeparture in ms
 * @param updatedAt - Timestamp to stamp onto the normalized row
 * @returns Convex-shaped actual row ready for upsert or merge
 */
const buildActualDockEventFromWrite = (
  write: ConvexActualDockWritePersistable,
  updatedAt: number
): ConvexActualDockEvent => {
  const anchorMs: number =
    write.EventActualTime !== undefined
      ? write.EventActualTime
      : (write.ScheduledDeparture as number);

  const eventKey =
    write.EventKey ??
    buildPhysicalActualEventKey(write.TripKey, write.EventType);

  const sailingDay = write.SailingDay ?? getSailingDay(new Date(anchorMs));

  const scheduledDeparture: number =
    write.ScheduledDeparture ?? write.EventActualTime ?? anchorMs;

  return {
    EventKey: eventKey,
    TripKey: write.TripKey,
    EventType: write.EventType,
    VesselAbbrev: write.VesselAbbrev,
    SailingDay: sailingDay,
    UpdatedAt: updatedAt,
    ScheduledDeparture: scheduledDeparture,
    TerminalAbbrev: write.TerminalAbbrev,
    EventOccurred: true,
    EventActualTime: write.EventActualTime,
  };
};

export { buildActualDockEventFromWrite, buildActualDockEvents };
