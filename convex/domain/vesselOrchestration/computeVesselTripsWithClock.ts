/**
 * Vessel trips compute with wall-clock anchor: prediction-fallback policy
 * (via {@link computeShouldRunPredictionFallback}, same as
 * {@link computeVesselTripsBundle} / `processVesselTrips`), and
 * {@link computeVesselTripsBundle}.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithPredictions,
} from "functions/vesselTrips/schemas";
import {
  computeShouldRunPredictionFallback,
  computeVesselTripsBundle,
  type ProcessVesselTripsDeps,
} from "./updateVesselTrips";
import type { VesselTripsComputeBundle } from "./updateVesselTrips/tripLifecycle/vesselTripsComputeBundle";

/**
 * Tick clock and trips compute bundle for sequential persistence in
 * `updateVesselOrchestrator`.
 */
export type VesselTripsWithClock = {
  tickStartedAt: number;
  tripsCompute: VesselTripsComputeBundle;
};

/**
 * Optional overrides for tests or replays.
 */
export type VesselTripsWithClockOptions = {
  /**
   * Fixed tick time (epoch ms). Production omits this; wall-clock `Date.now()`
   * anchors calendar-based policy (e.g. prediction-fallback by seconds-of-minute).
   */
  tickStartedAt?: number;
};

/**
 * Computes trip lifecycle data for one pass: anchors wall-clock policy and
 * builds {@link VesselTripsComputeBundle}.
 *
 * @param input - Converted locations and preloaded active trips
 * @param deps - Trip builders and schedule-backed adapters (from
 *   {@link createDefaultProcessVesselTripsDeps} in production)
 * @param options - Optional tick clock override for tests
 * @returns Tick time and bundle for `updateVesselTrips` / `persistVesselTripsCompute`
 */
export const computeVesselTripsWithClock = async (
  input: {
    convexLocations: ReadonlyArray<ConvexVesselLocation>;
    activeTrips: ReadonlyArray<
      ConvexVesselTrip | ConvexVesselTripWithPredictions
    >;
  },
  deps: ProcessVesselTripsDeps,
  options?: VesselTripsWithClockOptions
): Promise<VesselTripsWithClock> => {
  const tickStartedAt = options?.tickStartedAt ?? Date.now();

  const processOptions = {
    shouldRunPredictionFallback:
      computeShouldRunPredictionFallback(tickStartedAt),
  };

  const { bundle } = await computeVesselTripsBundle(
    input.convexLocations,
    tickStartedAt,
    deps,
    input.activeTrips,
    processOptions
  );

  return {
    tickStartedAt,
    tripsCompute: bundle,
  };
};
