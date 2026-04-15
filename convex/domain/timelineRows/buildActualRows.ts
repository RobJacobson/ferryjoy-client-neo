/**
 * Pure helpers for deriving normalized VesselTimeline actual boundary rows.
 */

import type {
  ConvexActualBoundaryEvent,
  ConvexActualBoundaryPatchPersistable,
} from "../../functions/eventsActual/schemas";
import type { ConvexVesselTimelineEventRecord } from "../../functions/vesselTimeline/schemas";
import { buildPhysicalActualEventKey } from "../../shared/physicalTripIdentity";
import { getSailingDay } from "../../shared/time";
import type { TripContextForActualRow } from "./bindActualRowsToTrips";

/**
 * Builds normalized actual rows from in-memory boundary event records.
 * PR3: emits a row only when `tripBySegmentKey` resolves a `TripKey` for
 * `event.SegmentKey`; otherwise skips (no persisted schedule-shaped identity).
 *
 * @param events - Boundary event records for one vessel/day slice
 * @param updatedAt - Timestamp to stamp onto rows that are inserted or updated
 * @param tripBySegmentKey - Schedule segment key to physical trip context
 * @returns Actual boundary rows for events that have an actual time and trip context
 */
export const buildActualBoundaryEvents = (
  events: ConvexVesselTimelineEventRecord[],
  updatedAt: number,
  tripBySegmentKey: Map<string, TripContextForActualRow>
): ConvexActualBoundaryEvent[] =>
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
 * Builds one normalized actual boundary row from a sparse actual patch.
 * When `SailingDay` or `ScheduledDeparture` are omitted (weak schedule
 * metadata), they are filled conservatively from `EventActualTime` or
 * `ScheduledDeparture` (whichever is present).
 *
 * @param patch - {@link ConvexActualBoundaryPatchPersistable}: `TripKey` plus
 *   at least one of `EventActualTime` or `ScheduledDeparture` (ms)
 * @param updatedAt - Timestamp to stamp onto the normalized row
 * @returns Persisted-shape actual boundary row
 */
export const buildActualBoundaryEventFromPatch = (
  patch: ConvexActualBoundaryPatchPersistable,
  updatedAt: number
): ConvexActualBoundaryEvent => {
  const anchorMs: number =
    patch.EventActualTime !== undefined
      ? patch.EventActualTime
      : (patch.ScheduledDeparture as number);

  const eventKey =
    patch.EventKey ??
    buildPhysicalActualEventKey(patch.TripKey, patch.EventType);

  const sailingDay = patch.SailingDay ?? getSailingDay(new Date(anchorMs));

  const scheduledDeparture: number =
    patch.ScheduledDeparture ?? patch.EventActualTime ?? anchorMs;

  return {
    EventKey: eventKey,
    TripKey: patch.TripKey,
    ScheduleKey: patch.ScheduleKey,
    EventType: patch.EventType,
    VesselAbbrev: patch.VesselAbbrev,
    SailingDay: sailingDay,
    UpdatedAt: updatedAt,
    ScheduledDeparture: scheduledDeparture,
    TerminalAbbrev: patch.TerminalAbbrev,
    EventOccurred: true,
    EventActualTime: patch.EventActualTime,
  };
};
