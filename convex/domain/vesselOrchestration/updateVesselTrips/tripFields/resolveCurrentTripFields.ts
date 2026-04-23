import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared/scheduleContinuity";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { getFallbackTripFields } from "./getFallbackTripFields";
import { getNextScheduledTripFromExistingTrip } from "./getNextScheduledTripFromExistingTrip";
import { getRolledOverScheduledTrip } from "./getRolledOverScheduledTrip";
import { getTripFieldsFromWsf } from "./getTripFieldsFromWsf";
import { hasWsfTripFields } from "./hasWsfTripFields";
import type { ResolvedCurrentTripFields, ScheduledTripMatch } from "./types";

/**
 * Resolves schedule-facing fields for the current trip row from WSF, schedule
 * evidence, or safe fallback reuse.
 *
 * Schedule match order: next leg from `existingTrip.NextScheduleKey` when it
 * validates, otherwise same-terminal schedule rollover from the prior departure.
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

  const scheduleMatch =
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

  if (scheduleMatch) {
    return resolvedFieldsFromScheduleMatch(scheduleMatch);
  }

  return getFallbackTripFields({
    location,
    existingTrip,
  });
};

/**
 * Maps a schedule segment match to stored current-trip field shape.
 *
 * @param match - Matched segment plus inference method metadata
 * @returns Resolved current-trip fields (no next-leg columns)
 */
const resolvedFieldsFromScheduleMatch = (
  match: ScheduledTripMatch
): ResolvedCurrentTripFields => ({
  ArrivingTerminalAbbrev: match.segment.ArrivingTerminalAbbrev,
  ScheduledDeparture: match.segment.DepartingTime,
  ScheduleKey: match.segment.Key,
  SailingDay: match.segment.SailingDay,
  tripFieldDataSource: "inferred",
  tripFieldInferenceMethod: match.tripFieldInferenceMethod,
});
