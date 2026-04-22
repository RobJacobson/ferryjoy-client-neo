/**
 * Schedule-half trip build for one live location ping: infer trip fields, build
 * the base trip from the prepared location, then enrich next-leg schedule
 * fields.
 *
 * ML prediction overlays run in **updateVesselPredictions** after rows persist;
 * this module does not attach prediction fields.
 */
import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared/scheduleContinuity";
import {
  applyInferredTripFields,
  attachNextScheduledTripFields,
  inferTripFieldsFromSchedule,
} from "domain/vesselOrchestration/updateVesselTrips/tripFields";
import type { InferredTripFields } from "domain/vesselOrchestration/updateVesselTrips/tripFields";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { baseTripFromLocation } from "./baseTripFromLocation";
import type { TripEvents } from "./tripEventTypes";

type BuildTripCoreOptions = {
  onTripFieldsResolved?: (args: {
    location: ConvexVesselLocation;
    existingTrip: ConvexVesselTrip | undefined;
    inferredTripFields: InferredTripFields;
  }) => void;
};

/**
 * Schedule enrichment only — no ML gates or ML attachment.
 *
 * @param currLocation - Latest vessel location from REST/API (raw feed)
 * @param existingTrip - Prior active trip for physical identity and trip-field
 *   carry-forward (undefined only when starting from a completion row as the
 *   “existing” context)
 * @param tripStart - True for a new trip instance, false for continuing
 * @param events - Flags from {@link detectTripEvents} for the **raw** ping
 * @param scheduleTables - Prefetched schedule evidence tables for this
 *   orchestrator ping
 * @param options - Optional orchestration hooks. Production logging is wired
 *   here so the trip-field inference helpers stay pure and low-noise, and so
 *   transient observability metadata never has to live on stored trip rows.
 * @returns Storage-shaped trip row (prediction fields not applied here)
 */
export const buildTripCore = (
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  tripStart: boolean,
  events: TripEvents,
  scheduleTables: ScheduledSegmentTables,
  options?: BuildTripCoreOptions
): ConvexVesselTrip => {
  const inferredTripFields = inferTripFieldsFromSchedule({
    location: currLocation,
    existingTrip,
    scheduleTables,
  });
  options?.onTripFieldsResolved?.({
    location: currLocation,
    existingTrip,
    inferredTripFields,
  });
  const locationWithTripFields = applyInferredTripFields(
    currLocation,
    inferredTripFields
  );
  const baseTrip = baseTripFromLocation(
    locationWithTripFields,
    existingTrip,
    tripStart
  );
  const withArriveDest = {
    ...baseTrip,
    // Same-trip arrivals are only stamped on continuing trips that were not
    // rolled over into a replacement trip.
    ArriveDest:
      baseTrip.ArriveDest ??
      (!tripStart && events.didJustArriveAtDock
        ? locationWithTripFields.TimeStamp
        : undefined),
  };
  const physicalIdentityReplaced =
    existingTrip?.TripKey !== undefined &&
    withArriveDest.TripKey !== undefined &&
    existingTrip.TripKey !== withArriveDest.TripKey;

  const scheduleAttachmentLost = didLoseScheduleAttachment(
    existingTrip,
    withArriveDest
  );

  const withScheduleKeyChangeClearedDerivedState =
    shouldClearDerivedStateOnScheduleTransition(
      events,
      physicalIdentityReplaced,
      scheduleAttachmentLost
    )
      ? clearDerivedStateOnScheduleKeyChange(withArriveDest)
      : withArriveDest;

  return attachNextScheduledTripFields({
    baseTrip: withScheduleKeyChangeClearedDerivedState,
    existingTrip,
    scheduleTables,
    events,
    tripStart,
  });
};

/**
 * Returns whether a continuing trip has detached from schedule alignment.
 *
 * This is distinct from a normal segment-to-segment switch: the physical trip
 * may remain the same while `ScheduleKey` becomes unavailable or unsafe. That
 * transition still needs to clear carried schedule-derived state so the row no
 * longer claims stale provisional schedule context.
 *
 * @param existingTrip - Previously stored trip, if any
 * @param nextTrip - Current proposal after base derivation
 * @returns True when schedule attachment was present and is now absent
 */
const didLoseScheduleAttachment = (
  existingTrip: ConvexVesselTrip | undefined,
  nextTrip: ConvexVesselTrip
): boolean =>
  existingTrip?.ScheduleKey !== undefined && nextTrip.ScheduleKey === undefined;

/**
 * Decide whether schedule-derived state should be cleared before enrichment.
 *
 * Two situations require clearing:
 * 1. the physical trip instance changed, so any carried next-leg or prediction
 *    state belongs to the previous trip
 * 2. the same physical trip lost schedule attachment entirely, so any carried
 *    next-leg schedule context or schedule-bound predictions are now stale
 *
 * A same-trip switch from one concrete `ScheduleKey` to another keeps derived
 * prediction state because the current implementation intentionally preserves
 * it across bounded schedule reattachment on the same trip.
 *
 * @param events - Detected trip events for the current ping
 * @param physicalIdentityReplaced - Whether `TripKey` changed this ping
 * @param scheduleAttachmentLost - Whether `ScheduleKey` changed to `undefined`
 * @returns True when carried schedule-derived fields should be cleared
 */
const shouldClearDerivedStateOnScheduleTransition = (
  events: TripEvents,
  physicalIdentityReplaced: boolean,
  scheduleAttachmentLost: boolean
): boolean =>
  events.scheduleKeyChanged &&
  (physicalIdentityReplaced || scheduleAttachmentLost);

/**
 * Clear schedule-derived fields that only make sense while the trip remains
 * attached to the same schedule evidence.
 *
 * These fields are only valid while the trip still owns a coherent schedule
 * attachment. Clear them when crossing a physical-trip boundary or when the
 * trip becomes physical-only because schedule alignment is no longer safe.
 *
 * @param trip - Candidate trip proposal
 * @returns Trip with carried schedule-derived fields removed
 */
const clearDerivedStateOnScheduleKeyChange = (
  trip: ConvexVesselTrip
): ConvexVesselTrip => ({
  ...trip,
  // Next-leg schedule snapshot belongs to the previous attachment only.
  NextScheduleKey: undefined,
  NextScheduledDeparture: undefined,
});
