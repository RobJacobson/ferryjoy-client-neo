/**
 * Next-leg schedule hints for a built trip row: preserve when the segment is
 * unchanged, otherwise fill from schedule tables.
 */

import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared/scheduleContinuity";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Attaches or preserves `NextScheduleKey` and `NextScheduledDeparture` on a
 * base trip row.
 *
 * @param baseTrip - Trip row after base build (before ML)
 * @param existingTrip - Prior active trip for same-segment carry-forward
 * @param scheduleTables - Prefetched schedule evidence
 * @returns Trip with next-leg fields merged when applicable
 */
export const attachNextScheduledTripFields = ({
  baseTrip,
  existingTrip,
  scheduleTables,
}: {
  baseTrip: ConvexVesselTrip;
  existingTrip: ConvexVesselTrip | undefined;
  scheduleTables: ScheduledSegmentTables;
}): ConvexVesselTrip => {
  const segmentKey = baseTrip.ScheduleKey;
  if (!segmentKey) {
    return baseTrip;
  }

  if (existingTrip?.ScheduleKey === segmentKey) {
    return {
      ...baseTrip,
      NextScheduleKey: baseTrip.NextScheduleKey ?? existingTrip.NextScheduleKey,
      NextScheduledDeparture:
        baseTrip.NextScheduledDeparture ?? existingTrip.NextScheduledDeparture,
    };
  }

  const scheduledSegment =
    scheduleTables.scheduledDepartureBySegmentKey[segmentKey];
  if (!scheduledSegment) {
    return baseTrip;
  }

  return {
    ...baseTrip,
    NextScheduleKey: scheduledSegment.NextKey ?? baseTrip.NextScheduleKey,
    NextScheduledDeparture:
      scheduledSegment.NextDepartingTime ?? baseTrip.NextScheduledDeparture,
  };
};
