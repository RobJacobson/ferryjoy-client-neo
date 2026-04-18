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
  computeShouldRunPredictionFallback,
  computeVesselTripTickWritePlan,
  type ProcessVesselTripsDeps,
  selectTripEligibleLocations,
} from "./updateVesselTrips";
import type { VesselTripTickWritePlan } from "./updateVesselTrips/tripLifecycle/vesselTripTickWritePlan";
import { nowMsForVesselOrchestratorTick } from "./vesselOrchestratorTickClock";

/**
 * Trip write payload and tick clock for sequential persistence in
 * `updateVesselOrchestrator`.
 */
export type VesselOrchestratorTripTickWrites = {
  tickStartedAt: number;
  tripWrites: VesselTripTickWritePlan;
};

/**
 * Optional overrides for tests or replays.
 */
export type ComputeVesselOrchestratorTripTickWritesOptions = {
  /**
   * Fixed tick time (epoch ms). Production omits this and uses
   * {@link nowMsForVesselOrchestratorTick}.
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
export const computeVesselOrchestratorTripTickWrites = async (
  input: {
    convexLocations: ReadonlyArray<ConvexVesselLocation>;
    terminalsIdentity: ReadonlyArray<TerminalIdentity>;
    activeTrips: ReadonlyArray<
      TickActiveTrip | ConvexVesselTripWithPredictions
    >;
  },
  deps: ProcessVesselTripsDeps,
  options?: ComputeVesselOrchestratorTripTickWritesOptions
): Promise<VesselOrchestratorTripTickWrites> => {
  const tickStartedAt =
    options?.tickStartedAt ?? nowMsForVesselOrchestratorTick();

  const tripEligibleLocations = selectTripEligibleLocations(
    input.convexLocations,
    input.terminalsIdentity
  );

  const processOptions = {
    shouldRunPredictionFallback:
      computeShouldRunPredictionFallback(tickStartedAt),
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
