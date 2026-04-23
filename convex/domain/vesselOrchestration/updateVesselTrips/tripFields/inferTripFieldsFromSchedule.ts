import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared/scheduleContinuity";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { buildInferredTripFields } from "./buildInferredTripFields";
import { findScheduledTripMatch } from "./findScheduledTripMatch";
import { getFallbackTripFields } from "./getFallbackTripFields";
import { getTripFieldsFromWsf } from "./getTripFieldsFromWsf";
import { hasWsfTripFields } from "./hasWsfTripFields";
import type { InferredTripFields } from "./types";

export const inferTripFieldsFromSchedule = ({
  location,
  existingTrip,
  scheduleTables,
}: {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  scheduleTables: ScheduledSegmentTables;
}): InferredTripFields => {
  if (hasWsfTripFields(location)) {
    return getTripFieldsFromWsf(location);
  }

  const match = findScheduledTripMatch({
    location,
    existingTrip,
    scheduleTables,
  });
  if (match) {
    return buildInferredTripFields(match);
  }

  return getFallbackTripFields({
    location,
    existingTrip,
  });
};
