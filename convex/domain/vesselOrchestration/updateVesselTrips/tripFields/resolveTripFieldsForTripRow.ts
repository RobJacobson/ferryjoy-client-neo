import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared/scheduleContinuity";
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

type TripFieldInferenceLogger = (
  message: string,
  context: TripFieldInferenceLogContext
) => void;

type ResolveTripFieldsForTripRowInput = {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  scheduleTables: ScheduledSegmentTables;
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

const logTripFieldInference = (
  args: TripFieldInferenceInput,
  logger: TripFieldInferenceLogger = console.info
): void => {
  const context = getTripFieldInferenceLogContext(args);
  if (context === undefined) {
    return;
  }

  logger(buildTripFieldInferenceMessage(context), context);
};

const resolveCurrentTripFields = ({
  location,
  existingTrip,
  scheduleTables,
}: Omit<
  ResolveTripFieldsForTripRowInput,
  "buildTrip" | "onTripFieldsResolved"
>): ResolvedCurrentTripFields => {
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

const attachNextScheduledTripFields = ({
  baseTrip,
  existingTrip,
  scheduleTables,
}: {
  baseTrip: ConvexVesselTrip;
  existingTrip: ConvexVesselTrip | undefined;
  scheduleTables: ScheduledSegmentTables;
}): ConvexVesselTrip => {
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
    scheduleTables.scheduledDepartureBySegmentKey[segmentKey];
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

export const resolveTripFieldsForTripRow = ({
  location,
  existingTrip,
  scheduleTables,
  buildTrip,
  onTripFieldsResolved,
}: ResolveTripFieldsForTripRowInput): ConvexVesselTrip => {
  const resolvedCurrentTripFields = resolveCurrentTripFields({
    location,
    existingTrip,
    scheduleTables,
  });
  const inferenceInput = {
    location,
    existingTrip,
    resolvedCurrentTripFields,
  };

  if (onTripFieldsResolved !== undefined) {
    onTripFieldsResolved(inferenceInput);
  } else {
    logTripFieldInference(inferenceInput);
  }

  return attachNextScheduledTripFields({
    baseTrip: buildTrip(resolvedCurrentTripFields),
    existingTrip,
    scheduleTables,
  });
};
