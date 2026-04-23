import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared/scheduleContinuity";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { ScheduledTripMatch } from "./types";

/**
 * When the prior trip carries a next segment key, resolve that segment if it
 * departs from the vessel's current departing terminal.
 *
 * @param location - Raw vessel location for this ping
 * @param existingTrip - Prior active trip (may carry `NextScheduleKey`)
 * @param scheduleTables - Prefetched schedule evidence tables
 * @returns Match tagged `next_scheduled_trip`, or null
 */
export const getNextScheduledTripFromExistingTrip = ({
  location,
  existingTrip,
  scheduleTables,
}: {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  scheduleTables: ScheduledSegmentTables;
}): ScheduledTripMatch | null => {
  const nextScheduleKey = existingTrip?.NextScheduleKey;
  if (!nextScheduleKey) {
    return null;
  }

  const segment =
    scheduleTables.scheduledDepartureBySegmentKey[nextScheduleKey];
  if (!segment) {
    return null;
  }

  if (segment.DepartingTerminalAbbrev !== location.DepartingTerminalAbbrev) {
    return null;
  }

  return {
    segment,
    tripFieldInferenceMethod: "next_scheduled_trip",
  };
};
