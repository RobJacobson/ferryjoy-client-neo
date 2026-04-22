import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { ScheduledTripMatch } from "./types";

export const getNextScheduledTripFromExistingTrip = ({
  location,
  existingTrip,
  scheduleTables,
}: {
  location: Pick<ConvexVesselLocation, "DepartingTerminalAbbrev">;
  existingTrip: Pick<ConvexVesselTrip, "NextScheduleKey"> | undefined;
  scheduleTables: ScheduledSegmentTables;
}): ScheduledTripMatch | null => {
  const nextScheduleKey = existingTrip?.NextScheduleKey;
  if (!nextScheduleKey) {
    return null;
  }

  const segment = scheduleTables.scheduledDepartureBySegmentKey[nextScheduleKey];
  if (!segment) {
    return null;
  }

  if (
    segment.DepartingTerminalAbbrev !== location.DepartingTerminalAbbrev
  ) {
    return null;
  }

  return {
    segment,
    tripFieldInferenceMethod: "next_scheduled_trip",
  };
};
