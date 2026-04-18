/**
 * Pure helpers for deriving normalized VesselTimeline actual dock-event rows.
 */

import type {
  ConvexActualDockEvent,
  ConvexActualDockWritePersistable,
} from "../../domain/events/actual/schemas";
import type { ConvexVesselTimelineEventRecord } from "../../functions/vesselTimeline/schemas";
import { buildPhysicalActualEventKey } from "../../shared/physicalTripIdentity";
import { getSailingDay } from "../../shared/time";
import type { TripContextForActualRow } from "./bindActualRowsToTrips";

/**
 * Builds normalized actual dock rows from in-memory event records.
 * PR3: emits a row only when `tripBySegmentKey` resolves a `TripKey` for
 * `event.SegmentKey`; otherwise skips (no persisted schedule-shaped identity).
 *
 * @param events - Event records for one vessel/day slice
 * @param updatedAt - Timestamp to stamp onto rows that are inserted or updated
 * @param tripBySegmentKey - Schedule segment key to physical trip context
 * @returns Actual dock rows for events that have an actual time and trip context
 */
export const buildActualDockEvents = (
  events: ConvexVesselTimelineEventRecord[],
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
          ScheduleKey: trip.ScheduleKey,
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
 * Builds one normalized actual dock row from a sparse write.
 * When `SailingDay` or `ScheduledDeparture` are omitted (weak schedule
 * metadata), they are filled conservatively from `EventActualTime` or
 * `ScheduledDeparture` (whichever is present).
 *
 * @param write - {@link ConvexActualDockWritePersistable}: `TripKey` plus at
 *   least one of `EventActualTime` or `ScheduledDeparture` (ms)
 * @param updatedAt - Timestamp to stamp onto the normalized row
 * @returns Persisted-shape actual dock row
 */
export const buildActualDockEventFromWrite = (
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
    ScheduleKey: write.ScheduleKey,
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
