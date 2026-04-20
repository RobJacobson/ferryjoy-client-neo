/**
 * Prediction attempt policy for vessel-trip ticks: clock window + gate booleans.
 * {@link computeVesselPredictionGates} shares inputs with the {@link buildTrip}
 * composer (after {@link buildTripCore}); Stage D derives gates from
 * {@link TripComputation} + `tickStartedAt` without reading ML fields on Stage C rows.
 *
 * **Phase C — attempt mode:** {@link PREDICTION_ATTEMPT_MODE} selects Option B
 * (`refill-when-gates`): phase-shaped gates + refill in {@link ./appendPredictions}
 * so ML can refresh every tick while `batchUpsertProposals` suppresses unchanged
 * rows. Option A (`empty-slot-only`) keeps the legacy event/fallback + empty-slot
 * gate math for cost-sensitive deployments.
 */

import type { TripComputation } from "domain/vesselOrchestration/updateVesselTrips/contracts";
import type { TripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripEventTypes";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { VesselPredictionGates } from "./applyVesselPredictions";

/**
 * Whether `computePredictions` may re-run models when slots already hold values,
 * and how {@link computeVesselPredictionGates} narrows attempts.
 *
 * - **`empty-slot-only`** — Legacy: event / minute-window triggers and “missing
 *   prediction” checks gate ML; `computePredictions` skips filled slots.
 * - **`refill-when-gates`** — Phase C default: gates follow trip phase (at-dock vs
 *   at-sea) only; `computePredictions` refills slots when gates allow (functions
 *   layer dedupes persists).
 */
export type PredictionAttemptMode = "empty-slot-only" | "refill-when-gates";

/** Product default: recompute when phase gates allow; rely on functions equality for writes. */
export const PREDICTION_ATTEMPT_MODE: PredictionAttemptMode =
  "refill-when-gates";

/** Same optional prediction slots as schedule proposals passed to gate math (storage row + hints). */
type GateTripShape = ConvexVesselTrip & {
  readonly AtDockDepartCurr?: unknown;
  readonly AtDockArriveNext?: unknown;
  readonly AtDockDepartNext?: unknown;
  readonly AtSeaArriveNext?: unknown;
  readonly AtSeaDepartNext?: unknown;
};

/**
 * True in the first 10 seconds of each UTC minute (epoch-second mod 60).
 * Drives optional schedule/prediction fallback with {@link computeVesselPredictionGates}.
 *
 * @param tickStartedAt - Orchestrator tick anchor (epoch ms)
 */
export const computeShouldRunPredictionFallback = (
  tickStartedAt: number
): boolean => {
  const secondWithinMinute = Math.floor(tickStartedAt / 1000) % 60;
  return secondWithinMinute < 10;
};

const noPredictionGates: VesselPredictionGates = {
  shouldAttemptAtDockPredictions: false,
  shouldAttemptAtSeaPredictions: false,
  didJustLeaveDock: false,
};

/**
 * Pure gate booleans for ML attempt policy. Call with the same trip row as
 * {@link buildTrip} uses after {@link buildTripCore} (`withFinalSchedule`);
 * `appendFinalSchedule` only adjusts schedule keys, so pre/post rows match for
 * fields read here.
 *
 * @param attemptMode - Defaults to {@link PREDICTION_ATTEMPT_MODE}. Pass
 * `empty-slot-only` in tests or for Option A parity.
 */
export const computeVesselPredictionGates = (
  gateTrip: GateTripShape,
  events: TripEvents,
  tripStart: boolean,
  shouldRunPredictionFallback: boolean,
  attemptMode: PredictionAttemptMode = PREDICTION_ATTEMPT_MODE
): VesselPredictionGates => {
  const canonicalStartAndOriginReady =
    Boolean(gateTrip.StartTime ?? gateTrip.TripStart) &&
    Boolean(gateTrip.ArrivedCurrActual ?? gateTrip.AtDockActual);

  if (attemptMode === "refill-when-gates") {
    const shouldAttemptAtDockPredictions =
      Boolean(gateTrip.AtDock) &&
      !gateTrip.LeftDock &&
      canonicalStartAndOriginReady;

    const shouldAttemptAtSeaPredictions =
      !gateTrip.AtDock && Boolean(gateTrip.LeftDockActual ?? gateTrip.LeftDock);

    return {
      shouldAttemptAtDockPredictions,
      shouldAttemptAtSeaPredictions,
      didJustLeaveDock: events.didJustLeaveDock,
    };
  }

  const shouldAttemptAtDockPredictions =
    Boolean(gateTrip.AtDock) &&
    !gateTrip.LeftDock &&
    canonicalStartAndOriginReady &&
    (tripStart || events.scheduleKeyChanged || shouldRunPredictionFallback) &&
    (!gateTrip.AtDockDepartCurr ||
      !gateTrip.AtDockArriveNext ||
      !gateTrip.AtDockDepartNext);
  const shouldAttemptAtSeaPredictions =
    !gateTrip.AtDock &&
    Boolean(gateTrip.LeftDockActual ?? gateTrip.LeftDock) &&
    (events.didJustLeaveDock ||
      events.scheduleKeyChanged ||
      shouldRunPredictionFallback) &&
    (!gateTrip.AtSeaArriveNext || !gateTrip.AtSeaDepartNext);

  return {
    shouldAttemptAtDockPredictions,
    shouldAttemptAtSeaPredictions,
    didJustLeaveDock: events.didJustLeaveDock,
  };
};

/**
 * Single derive entry for Stage D and orchestrator preload: uses
 * `tripCore.withFinalSchedule` + `events` + branch (as `tripStart`) + clock
 * fallback — not ML gate fields on {@link TripComputation}.
 *
 * **`tripStart`:** Completed-branch rows correspond to `buildTripCore` with
 * `tripStart: true`; current-branch with `tripStart: false`. That matches
 * `branch === "completed"` vs `"current"`. If a future caller needs a different
 * `tripStart`, thread an explicit flag on the handoff instead of inferring from
 * `branch` alone.
 */
export const derivePredictionGatesForComputation = (
  computation: TripComputation,
  tickStartedAt: number
): VesselPredictionGates => {
  const shouldRunPredictionFallback =
    computeShouldRunPredictionFallback(tickStartedAt);

  if (computation.branch === "current" && computation.events === undefined) {
    return noPredictionGates;
  }

  const events = computation.events;
  if (events === undefined) {
    throw new Error(
      `Missing trip events for prediction gates (vessel ${computation.vesselAbbrev}, branch ${computation.branch})`
    );
  }

  const tripStart = computation.branch === "completed";
  const gateTrip = computation.tripCore.withFinalSchedule as GateTripShape;

  return computeVesselPredictionGates(
    gateTrip,
    events,
    tripStart,
    shouldRunPredictionFallback,
    PREDICTION_ATTEMPT_MODE
  );
};
