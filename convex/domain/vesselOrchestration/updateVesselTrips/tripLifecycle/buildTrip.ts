/**
 * Schedule-half trip build for one live location ping: effective location, base
 * trip, then schedule leg enrichment.
 *
 * ML prediction overlays run in **updateVesselPredictions** after rows persist;
 * this module does not attach prediction fields.
 */
import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared";
import {
  appendFinalScheduleForLookup,
  resolveEffectiveLocationForLookup,
} from "domain/vesselOrchestration/updateVesselTrips/scheduleTripAdapters";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { baseTripFromLocation } from "./baseTripFromLocation";
import type { TripEvents } from "./tripEventTypes";

/**
 * Schedule enrichment only — no ML gates or ML attachment.
 *
 * @param currLocation - Latest vessel location from REST/API (raw feed)
 * @param existingTrip - Prior active trip for carry-forward and identity
 *   (undefined only when starting from a completion row as the “existing” context)
 * @param tripStart - True for a new trip instance, false for continuing
 * @param events - Flags from {@link detectTripEvents} for the **raw** ping
 * @param scheduleTables - Prefetched segment tables for this orchestrator ping
 * @returns Storage-shaped trip row (prediction fields not applied here)
 */
export const buildTripCore = (
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  tripStart: boolean,
  events: TripEvents,
  scheduleTables: ScheduledSegmentTables
): ConvexVesselTrip => {
  const effectiveLocation = resolveEffectiveLocationForLookup(
    scheduleTables,
    currLocation,
    existingTrip
  );
  // `deriveTripInputs` in base-trip construction uses this effective location;
  // event detection uses raw `currLocation` — they can differ for docked identity.
  const baseTrip = baseTripFromLocation(
    effectiveLocation,
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
        ? effectiveLocation.TimeStamp
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

  const tripForScheduleEnrichment = withScheduleKeyChangeClearedDerivedState;

  // Schedule enrichment is segment-key-based. Docked identity bootstrap happens
  // in `resolveEffectiveLocationForLookup`.
  const shouldAppendFinalSchedule = tripStart || events.scheduleKeyChanged;

  return shouldAppendFinalSchedule
    ? appendFinalScheduleForLookup(
        scheduleTables,
        tripForScheduleEnrichment,
        existingTrip
      )
    : tripForScheduleEnrichment;
};

/**
 * Returns whether a continuing trip has detached from schedule alignment.
 *
 * This is distinct from a normal segment-to-segment switch: the physical trip
 * may remain the same while `ScheduleKey` becomes unavailable or unsafe. That
 * transition still needs to clear carried schedule-derived state so the row no
 * longer claims stale continuity.
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
 * Clear schedule-derived continuity and prediction fields.
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
