/**
 * Trip-branch writable bundle for one vessel-orchestrator tick: tick clock,
 * prediction-fallback policy (via {@link computeShouldRunPredictionFallback}, same
 * as {@link computeVesselTripTickWritePlan} / `processVesselTrips`), and
 * {@link computeVesselTripTickWritePlan}.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  ConvexVesselTripWithPredictions,
  TickActiveTrip,
} from "functions/vesselTrips/schemas";
import {
  computeShouldRunPredictionFallback,
  computeVesselTripTickWritePlan,
  type ProcessVesselTripsDeps,
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
 * Computes trip lifecycle writes for one tick: anchors wall-clock policy and
 * builds {@link VesselTripTickWritePlan}.
 *
 * @param input - Converted locations and preloaded active trips
 * @param deps - Trip builders and schedule-backed adapters (from
 *   {@link createDefaultProcessVesselTripsDeps} in production)
 * @param options - Optional tick clock override for tests
 * @returns Tick time and trip writes for `applyVesselTripTickWritePlan`
 */
export const computeOrchestratorTripWrites = async (
  input: {
    convexLocations: ReadonlyArray<ConvexVesselLocation>;
    activeTrips: ReadonlyArray<
      TickActiveTrip | ConvexVesselTripWithPredictions
    >;
  },
  deps: ProcessVesselTripsDeps,
  options?: OrchestratorTripWritesOptions
): Promise<OrchestratorTripWrites> => {
  const tickStartedAt = options?.tickStartedAt ?? Date.now();

  const processOptions = {
    shouldRunPredictionFallback:
      computeShouldRunPredictionFallback(tickStartedAt),
  };

  const { plan } = await computeVesselTripTickWritePlan(
    input.convexLocations,
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
