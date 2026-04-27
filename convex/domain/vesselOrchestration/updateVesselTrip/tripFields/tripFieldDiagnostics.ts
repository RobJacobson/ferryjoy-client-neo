/**
 * Trip-field diagnostics helpers for optional inference logging.
 */
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { ResolvedCurrentTripFields } from "./types";

export type TripFieldInferenceInput = {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  resolvedCurrentTripFields: ResolvedCurrentTripFields;
};

export type TripFieldInferenceLogContext = {
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

type TripFieldSnapshot = {
  ArrivingTerminalAbbrev?: string;
  ScheduledDeparture?: number;
  ScheduleKey?: string;
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
