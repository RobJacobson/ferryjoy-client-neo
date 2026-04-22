import { getSegmentKeyFromBoundaryKey } from "domain/timelineRows/scheduledSegmentResolvers";
import {
  getScheduledDeparturesForVesselAndSailingDay,
  type ScheduledSegmentTables,
} from "domain/vesselOrchestration/shared/scheduleContinuity";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { getSailingDay } from "shared/time";
import type { ScheduledTripMatch } from "./types";

export const getRolledOverScheduledTrip = ({
  location,
  existingTrip,
  scheduleTables,
}: {
  location: Pick<
    ConvexVesselLocation,
    "VesselAbbrev" | "DepartingTerminalAbbrev"
  >;
  existingTrip: Pick<ConvexVesselTrip, "ScheduledDeparture"> | undefined;
  scheduleTables: ScheduledSegmentTables;
}): ScheduledTripMatch | null => {
  const scheduledDeparture = existingTrip?.ScheduledDeparture;
  if (scheduledDeparture === undefined) {
    return null;
  }

  const departures = getScheduledDeparturesForVesselAndSailingDay(
    scheduleTables,
    location.VesselAbbrev,
    getSailingDay(new Date(scheduledDeparture))
  );
  const nextDeparture = departures.find(
    (departure) =>
      departure.TerminalAbbrev === location.DepartingTerminalAbbrev &&
      departure.ScheduledDeparture > scheduledDeparture
  );
  if (!nextDeparture) {
    return null;
  }

  const segmentKey = getSegmentKeyFromBoundaryKey(nextDeparture.Key);
  const segment = scheduleTables.scheduledDepartureBySegmentKey[segmentKey];
  if (!segment) {
    return null;
  }

  return {
    segment,
    tripFieldInferenceMethod: "schedule_rollover",
  };
};
