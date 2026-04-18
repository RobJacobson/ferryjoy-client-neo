/**
 * Trip-branch bundle for one vessel-orchestrator tick: tick clock,
 * prediction-fallback policy (via {@link computeShouldRunPredictionFallback}, same
 * as {@link computeVesselTripTick} / `processVesselTrips`), and
 * {@link computeVesselTripTick}.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  ConvexVesselTripWithPredictions,
  TickActiveTrip,
} from "functions/vesselTrips/schemas";
import {
  computeShouldRunPredictionFallback,
  computeVesselTripTick,
  type ProcessVesselTripsDeps,
} from "./updateVesselTrips";
import type { VesselTripTick } from "./updateVesselTrips/tripLifecycle/vesselTripTick";

/**
 * Tick clock and trip payload for sequential persistence in
 * `updateVesselOrchestrator`.
 */
export type OrchestratorTripTick = {
  tickStartedAt: number;
  vesselTripTick: VesselTripTick;
};

/**
 * Optional overrides for tests or replays.
 */
export type OrchestratorTripTickOptions = {
  /**
   * Fixed tick time (epoch ms). Production omits this; wall-clock `Date.now()`
   * anchors calendar-based policy (e.g. prediction-fallback by seconds-of-minute).
   */
  tickStartedAt?: number;
};

/**
 * Computes trip lifecycle data for one tick: anchors wall-clock policy and
 * builds {@link VesselTripTick}.
 *
 * @param input - Converted locations and preloaded active trips
 * @param deps - Trip builders and schedule-backed adapters (from
 *   {@link createDefaultProcessVesselTripsDeps} in production)
 * @param options - Optional tick clock override for tests
 * @returns Tick time and trip payload for `updateVesselTrips` / `applyTripTickMutations`
 */
export const computeOrchestratorTripTick = async (
  input: {
    convexLocations: ReadonlyArray<ConvexVesselLocation>;
    activeTrips: ReadonlyArray<
      TickActiveTrip | ConvexVesselTripWithPredictions
    >;
  },
  deps: ProcessVesselTripsDeps,
  options?: OrchestratorTripTickOptions
): Promise<OrchestratorTripTick> => {
  const tickStartedAt = options?.tickStartedAt ?? Date.now();

  const processOptions = {
    shouldRunPredictionFallback:
      computeShouldRunPredictionFallback(tickStartedAt),
  };

  const { tick } = await computeVesselTripTick(
    input.convexLocations,
    tickStartedAt,
    deps,
    input.activeTrips,
    processOptions
  );

  return {
    tickStartedAt,
    vesselTripTick: tick,
  };
};
