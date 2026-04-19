/**
 * Build complete vessel-trip state for one live location tick.
 *
 * **O2 / O4:** {@link buildTripCore} is exported separately from the ML tail
 * (`applyVesselPredictions`). The orchestrator injects {@link buildTripCore} via
 * `ProcessVesselTripsDeps` / `createDefaultProcessVesselTripsDeps`; {@link buildTrip}
 * remains the composer for tests and non-orchestrator callers.
 */
import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import {
  applyVesselPredictions,
  type VesselPredictionGates,
  type VesselTripCoreProposal,
} from "domain/vesselOrchestration/updateVesselPredictions";
import type { VesselTripsBuildTripAdapters } from "domain/vesselOrchestration/updateVesselTrips/vesselTripsBuildTripAdapters";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import { baseTripFromLocation } from "./baseTripFromLocation";
import type { TripEvents } from "./tripEventTypes";

/**
 * Schedule/lifecycle trips never persist prediction columns; optional keys here
 * are in-memory hints only for {@link buildTripCore} gate math (fed to
 * `updateVesselPredictions`).
 */
/** TODO: remove this type */
type TripGateState = ConvexVesselTrip & {
  readonly AtDockDepartCurr?: unknown;
  readonly AtDockArriveNext?: unknown;
  readonly AtDockDepartNext?: unknown;
  readonly AtSeaArriveNext?: unknown;
  readonly AtSeaDepartNext?: unknown;
};

export type BuildTripCoreResult = {
  readonly withFinalSchedule: VesselTripCoreProposal;
  readonly gates: VesselPredictionGates;
};

/**
 * Build complete vessel trip from raw location data with all enrichments.
 *
 * Composes {@link buildTripCore} (effective location, base trip, schedule
 * enrichment, prediction **gates**) with {@link applyVesselPredictions} (ML
 * tail: at-dock / at-sea appenders and leave-dock actualization).
 * - Calls `baseTripFromLocation` for base trip
 * - Uses provided events for enrichment decisions
 * - Runs schedule lookups and prediction attempts (event-driven + time-based fallback) via the split above
 * - Returns fully enriched trip ready for persistence
 *
 * @param currLocation - Latest vessel location from REST/API
 * @param existingTrip - Previous trip for event detection (undefined for new trips)
 * @param tripStart - True for new trip (boundary or first), false for continuing
 * @param events - Detected trip events from detectTripEvents
 * @param shouldRunPredictionFallback - True when this tick should attempt
 * any missing fallback predictions
 * @param adapters - Injected resolve-location and schedule enrichment from the functions layer
 * @param predictionModelAccess - Production ML model reads (functions-layer `runQuery`)
 * @returns Fully enriched vessel trip
 *
 * **Production entry:** ticks wire this function through `ProcessVesselTripsDeps`;
 * use {@link buildTripCore} only when testing or composing the schedule half
 * without ML.
 */
export const buildTrip = async (
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  tripStart: boolean,
  events: TripEvents,
  shouldRunPredictionFallback: boolean,
  adapters: VesselTripsBuildTripAdapters,
  predictionModelAccess: VesselTripPredictionModelAccess
): Promise<ConvexVesselTripWithML> => {
  const core = await buildTripCore(
    currLocation,
    existingTrip,
    tripStart,
    events,
    shouldRunPredictionFallback,
    adapters
  );
  return applyVesselPredictions(
    predictionModelAccess,
    core.withFinalSchedule,
    core.gates
  );
};

/**
 * Schedule enrichment and prediction gates only — no ML attachment. Used by
 * {@link buildTrip} before {@link applyVesselPredictions}.
 *
 * Exported for tests and explicit composition; production callers inject
 * {@link buildTrip} (see `ProcessVesselTripsDeps`).
 *
 * @param currLocation - Latest vessel location from REST/API
 * @param existingTrip - Previous trip for event detection (undefined for new trips)
 * @param tripStart - True for new trip (boundary or first), false for continuing
 * @param events - Detected trip events from detectTripEvents
 * @param shouldRunPredictionFallback - True when this tick should attempt
 * any missing fallback predictions
 * @param adapters - Injected resolve-location and schedule enrichment from the functions layer
 * @returns Final schedule-shaped trip and gates for the prediction phase
 */
export const buildTripCore = async (
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  tripStart: boolean,
  events: TripEvents,
  shouldRunPredictionFallback: boolean,
  adapters: VesselTripsBuildTripAdapters
): Promise<BuildTripCoreResult> => {
  const { resolveEffectiveLocation, appendFinalSchedule } = adapters;
  const effectiveLocation = await resolveEffectiveLocation(
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

  const gateTrip = withScheduleKeyChangeClearedDerivedState as TripGateState;

  // Schedule enrichment is segment-key-based. Docked identity bootstrap now
  // happens once in `resolveEffectiveLocation`.
  const shouldAppendFinalSchedule = tripStart || events.scheduleKeyChanged;
  const canonicalStartAndOriginReady =
    Boolean(gateTrip.StartTime ?? gateTrip.TripStart) &&
    Boolean(gateTrip.ArrivedCurrActual ?? gateTrip.AtDockActual);
  // At-dock predictions belong only to real dock occupancy for a started trip.
  // This avoids generating model output for first-seen placeholder rows that
  // have not yet observed a trustworthy origin-arrival boundary.
  const shouldAttemptAtDockPredictions =
    gateTrip.AtDock &&
    !gateTrip.LeftDock &&
    canonicalStartAndOriginReady &&
    (tripStart || events.scheduleKeyChanged || shouldRunPredictionFallback) &&
    (!gateTrip.AtDockDepartCurr ||
      !gateTrip.AtDockArriveNext ||
      !gateTrip.AtDockDepartNext);
  // At-sea predictions are allowed once a real departure exists. Event ticks
  // trigger them immediately, and the short fallback window gives the system a
  // bounded retry path if that first prediction attempt fails.
  const shouldAttemptAtSeaPredictions =
    !gateTrip.AtDock &&
    Boolean(gateTrip.LeftDockActual ?? gateTrip.LeftDock) &&
    (events.didJustLeaveDock ||
      events.scheduleKeyChanged ||
      shouldRunPredictionFallback) &&
    (!gateTrip.AtSeaArriveNext || !gateTrip.AtSeaDepartNext);

  const withFinalSchedule = shouldAppendFinalSchedule
    ? await appendFinalSchedule(gateTrip, existingTrip)
    : gateTrip;

  return {
    withFinalSchedule,
    gates: {
      shouldAttemptAtDockPredictions,
      shouldAttemptAtSeaPredictions,
      didJustLeaveDock: events.didJustLeaveDock,
    },
  };
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
