import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared/scheduleContinuity";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { TripEvents } from "../tripLifecycle/tripEventTypes";

export const attachNextScheduledTripFields = ({
  baseTrip,
  existingTrip,
  scheduleTables,
  events: _events,
  tripStart: _tripStart,
}: {
  baseTrip: ConvexVesselTrip;
  existingTrip: ConvexVesselTrip | undefined;
  scheduleTables: ScheduledSegmentTables;
  events: Pick<TripEvents, "scheduleKeyChanged">;
  tripStart: boolean;
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
