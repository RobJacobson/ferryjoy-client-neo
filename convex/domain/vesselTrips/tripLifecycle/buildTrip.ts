/**
 * Build complete vessel-trip state for one live location tick.
 */
import type { ActionCtx } from "_generated/server";
import { actualizePredictionsOnLeaveDock } from "domain/ml/prediction";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import type { VesselTripsBuildTripAdapters } from "../vesselTripsBuildTripAdapters";
import {
  appendArriveDockPredictions,
  appendLeaveDockPredictions,
} from "./appendPredictions";
import { baseTripFromLocation } from "./baseTripFromLocation";
import type { TripEvents } from "./tripEventTypes";

/**
 * Build complete vessel trip from raw location data with all enrichments.
 *
 * Handles building, schedule lookups, and ML predictions in one place:
 * - Calls baseTripFromLocation for base trip
 * - Uses provided events for enrichment decisions
 * - Runs appropriate schedule lookups and predictions (event-driven + time-based fallback)
 * - Applies same-trip prediction actuals before persistence on leave-dock events
 * - Returns fully enriched trip ready for persistence
 *
 * @param ctx - Convex action context
 * @param currLocation - Latest vessel location from REST/API
 * @param existingTrip - Previous trip for event detection (undefined for new trips)
 * @param tripStart - True for new trip (boundary or first), false for continuing
 * @param events - Detected trip events from detectTripEvents
 * @param shouldRunPredictionFallback - True when this tick should attempt
 * any missing fallback predictions
 * @param adapters - Injected resolve-location and schedule enrichment from the functions layer
 * @returns Fully enriched vessel trip
 */
export const buildTrip = async (
  ctx: ActionCtx,
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  tripStart: boolean,
  events: TripEvents,
  shouldRunPredictionFallback: boolean,
  adapters: VesselTripsBuildTripAdapters
): Promise<ConvexVesselTripWithML> => {
  const { resolveEffectiveLocation, appendFinalSchedule } = adapters;
  const effectiveLocation = await resolveEffectiveLocation(
    ctx,
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

  // Schedule enrichment is segment-key-based. Docked identity bootstrap now
  // happens once in `resolveEffectiveLocation`.
  const shouldAppendFinalSchedule = tripStart || events.scheduleKeyChanged;
  const canonicalStartAndOriginReady =
    Boolean(
      withScheduleKeyChangeClearedDerivedState.StartTime ??
        withScheduleKeyChangeClearedDerivedState.TripStart
    ) &&
    Boolean(
      withScheduleKeyChangeClearedDerivedState.ArriveOriginDockActual ??
        withScheduleKeyChangeClearedDerivedState.AtDockActual
    );
  // At-dock predictions belong only to real dock occupancy for a started trip.
  // This avoids generating model output for first-seen placeholder rows that
  // have not yet observed a trustworthy origin-arrival boundary.
  const shouldAttemptAtDockPredictions =
    withScheduleKeyChangeClearedDerivedState.AtDock &&
    !withScheduleKeyChangeClearedDerivedState.LeftDock &&
    canonicalStartAndOriginReady &&
    (tripStart || events.scheduleKeyChanged || shouldRunPredictionFallback) &&
    (!withScheduleKeyChangeClearedDerivedState.AtDockDepartCurr ||
      !withScheduleKeyChangeClearedDerivedState.AtDockArriveNext ||
      !withScheduleKeyChangeClearedDerivedState.AtDockDepartNext);
  // At-sea predictions are allowed once a real departure exists. Event ticks
  // trigger them immediately, and the short fallback window gives the system a
  // bounded retry path if that first prediction attempt fails.
  const shouldAttemptAtSeaPredictions =
    !withScheduleKeyChangeClearedDerivedState.AtDock &&
    Boolean(
      withScheduleKeyChangeClearedDerivedState.DepartOriginActual ??
        withScheduleKeyChangeClearedDerivedState.LeftDockActual ??
        withScheduleKeyChangeClearedDerivedState.LeftDock
    ) &&
    (events.didJustLeaveDock ||
      events.scheduleKeyChanged ||
      shouldRunPredictionFallback) &&
    (!withScheduleKeyChangeClearedDerivedState.AtSeaArriveNext ||
      !withScheduleKeyChangeClearedDerivedState.AtSeaDepartNext);

  const withFinalSchedule = shouldAppendFinalSchedule
    ? await appendFinalSchedule(
        ctx,
        withScheduleKeyChangeClearedDerivedState,
        existingTrip
      )
    : withScheduleKeyChangeClearedDerivedState;
  const withAtDockPredictions = shouldAttemptAtDockPredictions
    ? await appendArriveDockPredictions(ctx, withFinalSchedule)
    : withFinalSchedule;
  const withAtSeaPredictions = shouldAttemptAtSeaPredictions
    ? await appendLeaveDockPredictions(ctx, withAtDockPredictions)
    : withAtDockPredictions;

  return events.didJustLeaveDock
    ? actualizePredictionsOnLeaveDock(withAtSeaPredictions)
    : withAtSeaPredictions;
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
  // Any carried next-leg snapshot or schedule-bound prediction state belongs
  // to the previous schedule attachment and must not survive detachment.
  NextScheduleKey: undefined,
  NextScheduledDeparture: undefined,
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
});
