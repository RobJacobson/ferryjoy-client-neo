import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared/scheduleContinuity";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { buildResolvedCurrentTripFields } from "./buildResolvedCurrentTripFields";
import { findScheduledTripMatch } from "./findScheduledTripMatch";
import { getFallbackTripFields } from "./getFallbackTripFields";
import { getTripFieldsFromWsf } from "./getTripFieldsFromWsf";
import { hasWsfTripFields } from "./hasWsfTripFields";
import type { ResolvedCurrentTripFields } from "./types";

/**
 * Resolves schedule-facing fields for the current trip row from WSF, schedule
 * evidence, or safe fallback reuse.
 *
 * @param location - Raw vessel location for this ping
 * @param existingTrip - Prior active trip for carry-forward context
 * @param scheduleTables - Prefetched schedule evidence tables
 * @returns {@link ResolvedCurrentTripFields} (next-leg fields are not included)
 */
export const resolveCurrentTripFields = ({
  location,
  existingTrip,
  scheduleTables,
}: {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  scheduleTables: ScheduledSegmentTables;
}): ResolvedCurrentTripFields => {
  if (hasWsfTripFields(location)) {
    return getTripFieldsFromWsf(location);
  }

  const match = findScheduledTripMatch({
    location,
    existingTrip,
    scheduleTables,
  });
  if (match) {
    return buildResolvedCurrentTripFields(match);
  }

  return getFallbackTripFields({
    location,
    existingTrip,
  });
};
