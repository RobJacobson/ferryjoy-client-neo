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
import type { ResolvedCurrentTripFields, ScheduledTripMatch } from "./types";

type TripFieldInferenceInput = {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  resolvedCurrentTripFields: ResolvedCurrentTripFields;
};

type TripFieldInferenceLogContext = {
  vesselAbbrev: string;
  tripFieldDataSource: ResolvedCurrentTripFields["tripFieldDataSource"];
  tripFieldInferenceMethod?: ResolvedCurrentTripFields["tripFieldInferenceMethod"];
  reason:
    | "inferred_trip_fields_started"
    | "inferred_trip_fields_updated"
    | "partial_wsf_conflict_with_inference"
    | "wsf_trip_fields_replaced_prior_values";
  previousTripFields?: TripFieldSnapshot;
  resolvedTripFields: TripFieldSnapshot;
  rawWsfTripFields: TripFieldSnapshot;
};

type ResolveTripFieldsForTripRowInput = {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  scheduleAccess: ScheduleContinuityAccess;
  buildTrip: (
    resolvedCurrentTripFields: ResolvedCurrentTripFields
  ) => ConvexVesselTrip;
  onTripFieldsResolved?: (args: TripFieldInferenceInput) => void;
};

type TripFieldSnapshot = {
  ArrivingTerminalAbbrev?: string;
  ScheduledDeparture?: number;
  ScheduleKey?: string;
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
 * Extracts comparable trip-field values from a row-like object.
 *
 * @param trip - Trip/location/resolved fields object containing trip-field keys
 * @returns Snapshot of arriving terminal, scheduled departure, and schedule key
 */
const tripFieldSnapshotFrom = (
  trip: ConvexVesselTrip | ConvexVesselLocation | ResolvedCurrentTripFields
): TripFieldSnapshot => ({
  ArrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev,
  ScheduledDeparture: trip.ScheduledDeparture,
  ScheduleKey: trip.ScheduleKey,
});

/**
 * Compares two trip-field snapshots for equality.
 *
 * @param left - First snapshot to compare
 * @param right - Second snapshot to compare
 * @returns True when all tracked trip-field values are equal
 */
const areTripFieldsEqual = (
  left: TripFieldSnapshot | undefined,
  right: TripFieldSnapshot | undefined
): boolean =>
  left?.ArrivingTerminalAbbrev === right?.ArrivingTerminalAbbrev &&
  left?.ScheduledDeparture === right?.ScheduledDeparture &&
  left?.ScheduleKey === right?.ScheduleKey;

/**
 * Detects whether partial WSF fields conflict with resolved inference.
 *
 * @param location - Raw WSF location row for this ping
 * @param resolvedTripFields - Resolved trip fields from inference path
 * @returns True when any present WSF field disagrees with resolved values
 */
const hasPartialWsfConflict = (
  location: ConvexVesselLocation,
  resolvedTripFields: TripFieldSnapshot
): boolean =>
  (location.ArrivingTerminalAbbrev !== undefined &&
    location.ArrivingTerminalAbbrev !==
      resolvedTripFields.ArrivingTerminalAbbrev) ||
  (location.ScheduledDeparture !== undefined &&
    location.ScheduledDeparture !== resolvedTripFields.ScheduledDeparture) ||
  (location.ScheduleKey !== undefined &&
    location.ScheduleKey !== resolvedTripFields.ScheduleKey);

/**
 * Builds structured inference-log context when a meaningful transition occurred.
 *
 * @param input - Location, prior trip, and resolved trip fields
 * @returns Log context describing the inference outcome, or undefined when no log needed
 */
const getTripFieldInferenceLogContext = ({
  location,
  existingTrip,
  resolvedCurrentTripFields,
}: TripFieldInferenceInput): TripFieldInferenceLogContext | undefined => {
  const previousTripFields =
    existingTrip === undefined
      ? undefined
      : tripFieldSnapshotFrom(existingTrip);
  const resolvedTripFields = tripFieldSnapshotFrom(resolvedCurrentTripFields);
  const rawWsfTripFields = tripFieldSnapshotFrom(location);
  const tripFieldsChanged = !areTripFieldsEqual(
    previousTripFields,
    resolvedTripFields
  );

  const shared = {
    vesselAbbrev: location.VesselAbbrev,
    tripFieldDataSource: resolvedCurrentTripFields.tripFieldDataSource,
    tripFieldInferenceMethod:
      resolvedCurrentTripFields.tripFieldInferenceMethod,
    previousTripFields,
    resolvedTripFields,
    rawWsfTripFields,
  };

  if (resolvedCurrentTripFields.tripFieldDataSource === "inferred") {
    const reason = hasPartialWsfConflict(location, resolvedTripFields)
      ? "partial_wsf_conflict_with_inference"
      : existingTrip === undefined
        ? "inferred_trip_fields_started"
        : tripFieldsChanged
          ? "inferred_trip_fields_updated"
          : undefined;

    if (reason === undefined) {
      return undefined;
    }

    return { ...shared, reason };
  }

  if (!tripFieldsChanged || existingTrip === undefined) {
    return undefined;
  }

  return {
    ...shared,
    reason: "wsf_trip_fields_replaced_prior_values",
  };
};

/**
 * Formats a human-readable message for trip-field inference logs.
 *
 * @param context - Structured inference-log context
 * @returns Single log line describing the inferred-field transition
 */
export const buildTripFieldInferenceMessage = (
  context: TripFieldInferenceLogContext
): string => {
  switch (context.reason) {
    case "inferred_trip_fields_started":
      return `[TripFields] ${context.vesselAbbrev} started provisional trip fields from schedule evidence`;
    case "inferred_trip_fields_updated":
      return `[TripFields] ${context.vesselAbbrev} updated provisional trip fields from schedule evidence`;
    case "partial_wsf_conflict_with_inference":
      return `[TripFields] ${context.vesselAbbrev} kept provisional trip fields despite partial WSF conflict`;
    case "wsf_trip_fields_replaced_prior_values":
      return `[TripFields] ${context.vesselAbbrev} applied authoritative WSF trip fields`;
  }
};

/**
 * Emits structured trip-field inference logs when resolution changed meaningfully.
 *
 * @param args - Location, prior trip, and resolved trip fields
 * @returns Structured context plus message when a meaningful event occurred
 */
export const getTripFieldInferenceLog = (
  args: TripFieldInferenceInput
): { message: string; context: TripFieldInferenceLogContext } | undefined => {
  const context = getTripFieldInferenceLogContext(args);
  if (context === undefined) {
    return undefined;
  }

  return {
    message: buildTripFieldInferenceMessage(context),
    context,
  };
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
