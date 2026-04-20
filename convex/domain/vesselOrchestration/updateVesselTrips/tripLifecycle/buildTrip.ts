/**
 * Schedule-half trip build for one live location tick: effective location, base
 * trip, schedule enrichment. ML runs in **updateVesselPredictions**; production
 * injects {@link buildTripCore} via `ProcessVesselTripsDeps`.
 */
import type { VesselTripsBuildTripAdapters } from "domain/vesselOrchestration/updateVesselTrips/vesselTripsBuildTripAdapters";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { baseTripFromLocation } from "./baseTripFromLocation";
import type { TripEvents } from "./tripEventTypes";

/**
 * Schedule enrichment only — no ML gates or ML attachment. Production ticks
 * inject this via `ProcessVesselTripsDeps`.
 *
 * @param currLocation - Latest vessel location from REST/API
 * @param existingTrip - Previous trip for event detection (undefined for new trips)
 * @param tripStart - True for new trip (boundary or first), false for continuing
 * @param events - Detected trip events from detectTripEvents
 * @param adapters - Injected resolve-location and schedule enrichment from the functions layer
 * @returns Schedule-enriched trip row (storage shape, predictions stripped upstream of ML)
 */
export const buildTripCore = (
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  tripStart: boolean,
  events: TripEvents,
  adapters: VesselTripsBuildTripAdapters
): ConvexVesselTrip => {
  const { resolveEffectiveLocation, appendFinalSchedule } = adapters;
  const effectiveLocation = resolveEffectiveLocation(
    currLocation,
    existingTrip
  );
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

  // Schedule enrichment is segment-key-based. Docked identity bootstrap now
  // happens once in `resolveEffectiveLocation`.
  const shouldAppendFinalSchedule = tripStart || events.scheduleKeyChanged;

  return shouldAppendFinalSchedule
    ? appendFinalSchedule(tripForScheduleEnrichment, existingTrip)
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
 * @param events - Detected trip events for the current tick
 * @param physicalIdentityReplaced - Whether `TripKey` changed this tick
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
