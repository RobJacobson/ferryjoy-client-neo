import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { InferredTripFields } from "./types";

type TripFieldSnapshot = {
  ArrivingTerminalAbbrev?: string;
  ScheduledDeparture?: number;
  ScheduleKey?: string;
};

export type TripFieldInferenceLogContext = {
  vesselAbbrev: string;
  tripFieldDataSource: InferredTripFields["tripFieldDataSource"];
  tripFieldInferenceMethod?: InferredTripFields["tripFieldInferenceMethod"];
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

const pickTripFields = (
  trip:
    | Pick<
        ConvexVesselTrip,
        "ArrivingTerminalAbbrev" | "ScheduledDeparture" | "ScheduleKey"
      >
    | Pick<
        ConvexVesselLocation,
        "ArrivingTerminalAbbrev" | "ScheduledDeparture" | "ScheduleKey"
      >
    | Pick<
        InferredTripFields,
        "ArrivingTerminalAbbrev" | "ScheduledDeparture" | "ScheduleKey"
      >
    | undefined
): TripFieldSnapshot | undefined =>
  trip === undefined
    ? undefined
    : {
        ArrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev,
        ScheduledDeparture: trip.ScheduledDeparture,
        ScheduleKey: trip.ScheduleKey,
      };

const areTripFieldsEqual = (
  left: TripFieldSnapshot | undefined,
  right: TripFieldSnapshot | undefined
): boolean =>
  left?.ArrivingTerminalAbbrev === right?.ArrivingTerminalAbbrev &&
  left?.ScheduledDeparture === right?.ScheduledDeparture &&
  left?.ScheduleKey === right?.ScheduleKey;

const hasPartialWsfConflict = (
  location: Pick<
    ConvexVesselLocation,
    "ArrivingTerminalAbbrev" | "ScheduledDeparture" | "ScheduleKey"
  >,
  resolvedTripFields: TripFieldSnapshot
): boolean =>
  (location.ArrivingTerminalAbbrev !== undefined &&
    location.ArrivingTerminalAbbrev !==
      resolvedTripFields.ArrivingTerminalAbbrev) ||
  (location.ScheduledDeparture !== undefined &&
    location.ScheduledDeparture !== resolvedTripFields.ScheduledDeparture) ||
  (location.ScheduleKey !== undefined &&
    location.ScheduleKey !== resolvedTripFields.ScheduleKey);

export const getTripFieldInferenceLogContext = ({
  location,
  existingTrip,
  inferredTripFields,
}: {
  location: Pick<
    ConvexVesselLocation,
    | "VesselAbbrev"
    | "ArrivingTerminalAbbrev"
    | "ScheduledDeparture"
    | "ScheduleKey"
  >;
  existingTrip:
    | Pick<
        ConvexVesselTrip,
        "ArrivingTerminalAbbrev" | "ScheduledDeparture" | "ScheduleKey"
      >
    | undefined;
  inferredTripFields: Pick<
    InferredTripFields,
    | "ArrivingTerminalAbbrev"
    | "ScheduledDeparture"
    | "ScheduleKey"
    | "tripFieldDataSource"
    | "tripFieldInferenceMethod"
  >;
}): TripFieldInferenceLogContext | undefined => {
  const previousTripFields = pickTripFields(existingTrip);
  const resolvedTripFields = pickTripFields(inferredTripFields)!;
  const rawWsfTripFields = pickTripFields(location)!;
  const tripFieldsChanged = !areTripFieldsEqual(
    previousTripFields,
    resolvedTripFields
  );

  if (inferredTripFields.tripFieldDataSource === "inferred") {
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
      tripFieldDataSource: inferredTripFields.tripFieldDataSource,
      tripFieldInferenceMethod: inferredTripFields.tripFieldInferenceMethod,
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
    tripFieldDataSource: inferredTripFields.tripFieldDataSource,
    tripFieldInferenceMethod: inferredTripFields.tripFieldInferenceMethod,
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

export const logTripFieldInference = (
  args: Parameters<typeof getTripFieldInferenceLogContext>[0],
  logger: TripFieldInferenceLogger = console.info
): void => {
  const context = getTripFieldInferenceLogContext(args);
  if (context === undefined) {
    return;
  }

  logger(buildTripFieldInferenceMessage(context), context);
};
