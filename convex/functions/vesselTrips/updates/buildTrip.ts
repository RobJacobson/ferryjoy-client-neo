/**
 * Build complete vessel-trip state for one live location tick.
 */
import type { ActionCtx } from "_generated/server";
import { actualizePredictionsOnLeaveDock } from "domain/ml/prediction";
import type { ResolvedVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  appendArriveDockPredictions,
  appendLeaveDockPredictions,
} from "./appendPredictions";
import { appendFinalSchedule } from "./appendSchedule";
import { baseTripFromLocation } from "./baseTripFromLocation";
import { resolveEffectiveLocation } from "./effectiveLocation";
import type { TripEvents } from "./eventDetection";

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
 * @returns Fully enriched vessel trip
 */
export const buildTrip = async (
  ctx: ActionCtx,
  currLocation: ResolvedVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  tripStart: boolean,
  events: TripEvents,
  shouldRunPredictionFallback: boolean
): Promise<ConvexVesselTrip> => {
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
  const withKeyChangeClearedDerivedState = events.keyChanged
    ? clearDerivedStateOnKeyChange(withArriveDest)
    : withArriveDest;

  // Schedule enrichment is key-based only. Docked identity bootstrap now
  // happens once in `resolveEffectiveLocation`.
  const shouldAppendFinalSchedule = tripStart || events.keyChanged;
  // At-dock predictions belong only to real dock occupancy for a started trip.
  // This avoids generating model output for first-seen placeholder rows that
  // have not yet observed a trustworthy trip start.
  const shouldAttemptAtDockPredictions =
    withKeyChangeClearedDerivedState.AtDock &&
    !withKeyChangeClearedDerivedState.LeftDock &&
    Boolean(withKeyChangeClearedDerivedState.TripStart) &&
    (tripStart || events.keyChanged || shouldRunPredictionFallback) &&
    (!withKeyChangeClearedDerivedState.AtDockDepartCurr ||
      !withKeyChangeClearedDerivedState.AtDockArriveNext ||
      !withKeyChangeClearedDerivedState.AtDockDepartNext);
  // At-sea predictions are allowed once a real departure exists. Event ticks
  // trigger them immediately, and the short fallback window gives the system a
  // bounded retry path if that first prediction attempt fails.
  const shouldAttemptAtSeaPredictions =
    !withKeyChangeClearedDerivedState.AtDock &&
    Boolean(withKeyChangeClearedDerivedState.LeftDock) &&
    (events.didJustLeaveDock || events.keyChanged || shouldRunPredictionFallback) &&
    (!withKeyChangeClearedDerivedState.AtSeaArriveNext ||
      !withKeyChangeClearedDerivedState.AtSeaDepartNext);

  const withFinalSchedule = shouldAppendFinalSchedule
    ? await appendFinalSchedule(
        ctx,
        withKeyChangeClearedDerivedState,
        existingTrip
      )
    : withKeyChangeClearedDerivedState;
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

const clearDerivedStateOnKeyChange = (
  trip: ConvexVesselTrip
): ConvexVesselTrip => ({
  ...trip,
  // Key changes represent a new schedule identity, so any carried next-leg
  // snapshot or prediction state belongs to the previous identity.
  NextKey: undefined,
  NextScheduledDeparture: undefined,
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
});
