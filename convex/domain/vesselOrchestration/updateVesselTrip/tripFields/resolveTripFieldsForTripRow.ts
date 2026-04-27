/**
 * Trip-field resolution and schedule attachment for one trip row.
 */
import type { ScheduleContinuityAccess } from "domain/vesselOrchestration/shared/scheduleContinuity";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { getFallbackTripFields } from "./getFallbackTripFields";
import { getNextScheduledTripFromExistingTrip } from "./getNextScheduledTripFromExistingTrip";
import { getRolledOverScheduledTrip } from "./getRolledOverScheduledTrip";
import { getTripFieldsFromWsf } from "./getTripFieldsFromWsf";
import { hasWsfTripFields } from "./hasWsfTripFields";
import type { TripFieldInferenceInput } from "./tripFieldDiagnostics";
import type { ResolvedCurrentTripFields, ScheduledTripMatch } from "./types";

type ResolveTripFieldsForTripRowInput = {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  scheduleAccess: ScheduleContinuityAccess;
  buildTrip: (
    resolvedCurrentTripFields: ResolvedCurrentTripFields
  ) => ConvexVesselTrip;
  onTripFieldsResolved?: (args: TripFieldInferenceInput) => void;
};

/**
 * Resolves trip fields, emits inference diagnostics, and attaches next-leg fields.
 *
 * @param input - Location, prior trip, schedule tables, and trip builder callback
 * @returns Built trip row with resolved current and next schedule fields
 */
export const resolveTripFieldsForTripRow = async ({
  location,
  existingTrip,
  scheduleAccess,
  buildTrip,
  onTripFieldsResolved,
}: ResolveTripFieldsForTripRowInput): Promise<ConvexVesselTrip> => {
  const resolvedCurrentTripFields = await resolveCurrentTripFields({
    location,
    existingTrip,
    scheduleAccess,
  });
  const inferenceInput = {
    location,
    existingTrip,
    resolvedCurrentTripFields,
  };

  if (onTripFieldsResolved !== undefined) {
    onTripFieldsResolved(inferenceInput);
  }

  return attachNextScheduledTripFields({
    baseTrip: buildTrip(resolvedCurrentTripFields),
    existingTrip,
    scheduleAccess,
  });
};

/**
 * Resolves current-trip fields from WSF, schedule evidence, or fallback logic.
 *
 * @param input - Location, prior trip, and schedule lookup tables
 * @returns Resolved current-trip fields with data-source metadata
 */
const resolveCurrentTripFields = async ({
  location,
  existingTrip,
  scheduleAccess,
}: Omit<
  ResolveTripFieldsForTripRowInput,
  "buildTrip" | "onTripFieldsResolved"
>): Promise<ResolvedCurrentTripFields> => {
  if (hasWsfTripFields(location)) {
    return getTripFieldsFromWsf(location);
  }

  // Prefer explicit next-segment continuity before rollover lookup.
  const nextScheduledTrip = await getNextScheduledTripFromExistingTrip({
    location,
    existingTrip,
    scheduleAccess,
  });
  const scheduleMatch =
    nextScheduledTrip ??
    (await getRolledOverScheduledTrip({
      location,
      existingTrip,
      scheduleAccess,
    }));

  if (scheduleMatch) {
    return resolvedFieldsFromScheduleMatch(scheduleMatch);
  }

  return getFallbackTripFields({
    location,
    existingTrip,
  });
};

/**
 * Converts a matched scheduled segment into resolved current-trip fields.
 *
 * @param match - Scheduled segment match and inference method
 * @returns Resolved fields marked as inferred from schedule evidence
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

/**
 * Attaches next scheduled segment fields while preserving continuity when possible.
 *
 * @param args - Built trip row, prior trip row, and schedule lookup tables
 * @returns Trip row with next schedule key/departure fields populated or cleared
 */
const attachNextScheduledTripFields = async ({
  baseTrip,
  existingTrip,
  scheduleAccess,
}: {
  baseTrip: ConvexVesselTrip;
  existingTrip: ConvexVesselTrip | undefined;
  scheduleAccess: ScheduleContinuityAccess;
}): Promise<ConvexVesselTrip> => {
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
    await scheduleAccess.getScheduledSegmentByKey(segmentKey);
  if (!scheduledSegment) {
    return {
      ...baseTrip,
      NextScheduleKey: undefined,
      NextScheduledDeparture: undefined,
    };
  }

  return {
    ...baseTrip,
    NextScheduleKey: scheduledSegment.NextKey ?? baseTrip.NextScheduleKey,
    NextScheduledDeparture:
      scheduledSegment.NextDepartingTime ?? baseTrip.NextScheduledDeparture,
  };
};
