import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared/scheduleContinuity";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

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
      NextScheduleKey:
        baseTrip.NextScheduleKey ?? existingTrip.NextScheduleKey,
      NextScheduledDeparture:
        baseTrip.NextScheduledDeparture ?? existingTrip.NextScheduledDeparture,
    };
  }

  const scheduledSegment = scheduleTables.scheduledDepartureBySegmentKey[segmentKey];
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
