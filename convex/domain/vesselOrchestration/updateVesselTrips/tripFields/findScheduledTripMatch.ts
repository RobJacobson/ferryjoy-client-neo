import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared/scheduleContinuity";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { getNextScheduledTripFromExistingTrip } from "./getNextScheduledTripFromExistingTrip";
import { getRolledOverScheduledTrip } from "./getRolledOverScheduledTrip";
import type { ScheduledTripMatch } from "./types";

export const findScheduledTripMatch = ({
  location,
  existingTrip,
  scheduleTables,
}: {
  location: Pick<
    ConvexVesselLocation,
    "VesselAbbrev" | "DepartingTerminalAbbrev"
  >;
  existingTrip: Pick<
    ConvexVesselTrip,
    "NextScheduleKey" | "ScheduledDeparture"
  > | undefined;
  scheduleTables: ScheduledSegmentTables;
}): ScheduledTripMatch | null =>
  getNextScheduledTripFromExistingTrip({
    location,
    existingTrip,
    scheduleTables,
  }) ??
  getRolledOverScheduledTrip({
    location,
    existingTrip,
    scheduleTables,
  });
