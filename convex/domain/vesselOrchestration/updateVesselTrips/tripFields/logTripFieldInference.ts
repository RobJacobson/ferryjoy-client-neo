import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type {
  ResolvedCurrentTripFields,
  TripFieldDataSource,
  TripFieldInferenceMethod,
} from "./types";

type TripFieldSnapshot = {
  ArrivingTerminalAbbrev?: string;
  ScheduledDeparture?: number;
  ScheduleKey?: string;
};

/**
 * Inputs for trip-field inference logging: full feed location, optional prior
 * active trip, and resolved current-trip fields from schedule/WSF policy.
 */
export type TripFieldInferenceInput = {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  resolvedCurrentTripFields: ResolvedCurrentTripFields;
};

export type TripFieldInferenceLogContext = {
  vesselAbbrev: string;
  tripFieldDataSource: TripFieldDataSource;
  tripFieldInferenceMethod?: TripFieldInferenceMethod;
  reason:
    | "inferred_trip_fields_started"
    | "inferred_trip_fields_updated"
    | "partial_wsf_conflict_with_inference"
    | "wsf_trip_fields_replaced_prior_values";
  previousTripFields?: TripFieldSnapshot;
  resolvedTripFields: TripFieldSnapshot;
  rawWsfTripFields: TripFieldSnapshot;
};

type TripFieldInferenceLogger = (
  message: string,
  context: TripFieldInferenceLogContext
) => void;

/**
 * Builds a snapshot of the three comparable trip-field columns.
 *
 * @param trip - Location, trip row, or resolved fields carrying those columns
 * @returns Plain object (each property may still be undefined)
 */
const tripFieldSnapshotFrom = (
  trip: ConvexVesselTrip | ConvexVesselLocation | ResolvedCurrentTripFields
): TripFieldSnapshot => ({
  ArrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev,
  ScheduledDeparture: trip.ScheduledDeparture,
  ScheduleKey: trip.ScheduleKey,
});

const areTripFieldsEqual = (
  left: TripFieldSnapshot | undefined,
  right: TripFieldSnapshot | undefined
): boolean =>
  left?.ArrivingTerminalAbbrev === right?.ArrivingTerminalAbbrev &&
  left?.ScheduledDeparture === right?.ScheduledDeparture &&
  left?.ScheduleKey === right?.ScheduleKey;

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
 * Builds structured log context when resolved trip fields warrant observability.
 *
 * @param location - Raw location row for this ping
 * @param existingTrip - Prior active trip, when present
 * @param resolvedCurrentTripFields - Output of current-trip resolution
 * @returns Log context, or undefined when no log line should emit
 */
export const getTripFieldInferenceLogContext = ({
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

    return {
      vesselAbbrev: location.VesselAbbrev,
      tripFieldDataSource: resolvedCurrentTripFields.tripFieldDataSource,
      tripFieldInferenceMethod:
        resolvedCurrentTripFields.tripFieldInferenceMethod,
      reason,
      previousTripFields,
      resolvedTripFields,
      rawWsfTripFields,
    };
  }

  if (!tripFieldsChanged) {
    return undefined;
  }

  if (existingTrip === undefined) {
    return undefined;
  }

  return {
    vesselAbbrev: location.VesselAbbrev,
    tripFieldDataSource: resolvedCurrentTripFields.tripFieldDataSource,
    tripFieldInferenceMethod:
      resolvedCurrentTripFields.tripFieldInferenceMethod,
    reason: "wsf_trip_fields_replaced_prior_values",
    previousTripFields,
    resolvedTripFields,
    rawWsfTripFields,
  };
};

const buildTripFieldInferenceMessage = (
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
 * Emits trip-field inference observability when {@link getTripFieldInferenceLogContext}
 * returns a payload.
 *
 * @param args - Same inputs as `getTripFieldInferenceLogContext`
 * @param logger - Log sink (defaults to `console.info`)
 */
export const logTripFieldInference = (
  args: TripFieldInferenceInput,
  logger: TripFieldInferenceLogger = console.info
): void => {
  const context = getTripFieldInferenceLogContext(args);
  if (context === undefined) {
    return;
  }

  logger(buildTripFieldInferenceMessage(context), context);
};
