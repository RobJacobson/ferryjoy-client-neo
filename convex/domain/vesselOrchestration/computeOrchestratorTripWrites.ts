/**
 * Trip-branch writable bundle for one vessel-orchestrator tick: passenger-terminal
 * gating, tick clock, prediction fallback policy, and
 * {@link computeVesselTripTickWritePlan}.
 */

import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  ConvexVesselTripWithPredictions,
  TickActiveTrip,
} from "functions/vesselTrips/schemas";
import {
  computeVesselTripTickWritePlan,
  PREDICTION_FALLBACK_WINDOW_SECONDS,
  type ProcessVesselTripsDeps,
  selectTripEligibleLocations,
} from "./updateVesselTrips";
import type { VesselTripTickWritePlan } from "./updateVesselTrips/tripLifecycle/vesselTripTickWritePlan";

/**
 * Trip write payload and tick clock for sequential persistence in
 * `updateVesselOrchestrator`.
 */
export type OrchestratorTripWrites = {
  tickStartedAt: number;
  tripWrites: VesselTripTickWritePlan;
};

/**
 * Optional overrides for tests or replays.
 */
export type OrchestratorTripWritesOptions = {
  /**
   * Fixed tick time (epoch ms). Production omits this; wall-clock `Date.now()`
   * anchors calendar-based policy (e.g. prediction-fallback by seconds-of-minute).
   */
  tickStartedAt?: number;
};

/**
 * Computes trip lifecycle writes for one tick: filters to trip-eligible locations,
 * anchors wall-clock policy, and builds {@link VesselTripTickWritePlan}.
 *
 * @param input - Converted locations, terminal snapshot, and preloaded active trips
 * @param deps - Trip builders and schedule-backed adapters (from
 *   {@link createDefaultProcessVesselTripsDeps} in production)
 * @param options - Optional tick clock override for tests
 * @returns Tick time and trip writes for `applyVesselTripTickWritePlan`
 */
export const computeOrchestratorTripWrites = async (
  input: {
    convexLocations: ReadonlyArray<ConvexVesselLocation>;
    terminalsIdentity: ReadonlyArray<TerminalIdentity>;
    activeTrips: ReadonlyArray<
      TickActiveTrip | ConvexVesselTripWithPredictions
    >;
  },
  deps: ProcessVesselTripsDeps,
  options?: OrchestratorTripWritesOptions
): Promise<OrchestratorTripWrites> => {
  const tickStartedAt = options?.tickStartedAt ?? Date.now();

  const tripEligibleLocations = selectTripEligibleLocations(
    input.convexLocations,
    input.terminalsIdentity
  );

  const processOptions = {
    shouldRunPredictionFallback:
      new Date(tickStartedAt).getSeconds() < PREDICTION_FALLBACK_WINDOW_SECONDS,
  };

  const { plan } = await computeVesselTripTickWritePlan(
    tripEligibleLocations,
    tickStartedAt,
    deps,
    input.activeTrips,
    processOptions
  );

  return {
    tickStartedAt,
    tripWrites: plan,
  };
};
