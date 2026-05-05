/**
 * Builds optional diagnostics for schedule resolution outcomes.
 *
 * Schedule inference is expected during WSF gaps, so routine reuse should stay
 * quiet. These helpers identify meaningful schedule-field transitions and
 * produce structured context for targeted logs.
 */
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { ResolvedCurrentTripFields } from "./types";

type ScheduleResolutionLogInput = {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  current: ResolvedCurrentTripFields;
};

type ScheduleResolutionLogContext = {
  vesselAbbrev: string;
  tripFieldResolutionMethod?: ResolvedCurrentTripFields["tripFieldResolutionMethod"];
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
 * This normalizer lets diagnostics compare prior, resolved, and raw WSF
 * values using one compact shape. Keeping the snapshot intentionally narrow
 * avoids noisy logs and keeps change reasoning focused on schedule identity.
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
 * Undefined on either side is treated as absent data rather than a mismatch on
 * its own. This keeps diagnostics aligned with sparse storage behavior where
 * optional schedule fields may be omitted entirely.
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
 * WSF frequently provides only a subset of trip fields during transitions, so
 * this check compares only fields that were actually present on the ping. That
 * lets logs distinguish genuine conflicts from missing feed values.
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
 * The function suppresses routine no-op outcomes and emits context only when
 * operators would need visibility, such as inferred-field start/update,
 * partial-feed conflicts, or authoritative WSF replacement of prior values.
 *
 * @param input - Location, prior trip, and resolved trip fields
 * @returns Log context describing the inference outcome, or undefined when no log needed
 */
const getScheduleResolutionLogContext = ({
  location,
  existingTrip,
  current,
}: ScheduleResolutionLogInput): ScheduleResolutionLogContext | undefined => {
  const tripFieldResolutionMethod = current.tripFieldResolutionMethod;
  // Skip diagnostics when no resolver method is attached to this row update.
  if (tripFieldResolutionMethod === undefined) {
    return undefined;
  }

  const previousTripFields =
    existingTrip === undefined
      ? undefined
      : tripFieldSnapshotFrom(existingTrip);
  const resolvedTripFields = tripFieldSnapshotFrom(current);
  const rawWsfTripFields = tripFieldSnapshotFrom(location);
  const tripFieldsChanged = !areTripFieldsEqual(
    previousTripFields,
    resolvedTripFields
  );

  const shared = {
    vesselAbbrev: location.VesselAbbrev,
    tripFieldResolutionMethod,
    previousTripFields,
    resolvedTripFields,
    rawWsfTripFields,
  };

  if (tripFieldResolutionMethod !== "wsfRealtimeFields") {
    // Inference paths log only on start, update, or explicit conflict cases.
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
 * Message text is intentionally concise and reason-based so dashboards and
 * tail logs can be scanned quickly without opening structured payload fields.
 *
 * @param context - Structured inference-log context
 * @returns Single log line describing the inferred-field transition
 */
const buildScheduleResolutionMessage = (
  context: ScheduleResolutionLogContext
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
 * This adapter centralizes the context-plus-message contract so callers can
 * write one logging branch and still preserve both readable text and the
 * structured fields needed for debugging and aggregation.
 *
 * @param args - Location, prior trip, and resolved trip fields
 * @returns Structured context plus message when a meaningful event occurred
 */
const getScheduleResolutionLog = (
  args: ScheduleResolutionLogInput
): { message: string; context: ScheduleResolutionLogContext } | undefined => {
  const context = getScheduleResolutionLogContext(args);
  // Preserve quiet defaults by returning undefined for non-meaningful outcomes.
  if (context === undefined) {
    return undefined;
  }

  return {
    message: buildScheduleResolutionMessage(context),
    context,
  };
};

export type { ScheduleResolutionLogContext, ScheduleResolutionLogInput };
export { buildScheduleResolutionMessage, getScheduleResolutionLog };
