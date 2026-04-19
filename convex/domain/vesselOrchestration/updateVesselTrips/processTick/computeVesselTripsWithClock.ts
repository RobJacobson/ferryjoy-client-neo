/**
 * Vessel trips compute with wall-clock anchor: prediction-fallback policy
 * (via {@link computeShouldRunPredictionFallback}, same as
 * {@link computeVesselTripsBundle} / `processVesselTrips`), and
 * {@link computeVesselTripsBundle}.
 *
 * Callers must pass {@link VesselTripsWithClockOptions.tickStartedAt}; this module
 * does not default `Date.now()` (the orchestrator owns tick creation).
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithPredictions,
} from "functions/vesselTrips/schemas";
import type { VesselTripsComputeBundle } from "../tripLifecycle/vesselTripsComputeBundle";
import {
  computeVesselTripsBundle,
  type ProcessVesselTripsDeps,
} from "./processVesselTrips";
import { computeShouldRunPredictionFallback } from "./tickPredictionPolicy";

/**
 * Tick clock and trips compute bundle for sequential persistence in
 * `updateVesselOrchestrator`.
 *
 * **`tickStartedAt`** — Echo of the value passed into {@link computeVesselTripsWithClock};
 * use the orchestrator-supplied anchor as the source of truth, not this field alone.
 */
export type VesselTripsWithClock = {
  /** Echo of the `tickStartedAt` passed in via {@link VesselTripsWithClockOptions}. */
  tickStartedAt: number;
  tripsCompute: VesselTripsComputeBundle;
};

/**
 * Required tick clock for every {@link computeVesselTripsWithClock} call (tests pass
 * fixed instants; production passes the anchor from `updateVesselOrchestrator`).
 */
export type VesselTripsWithClockOptions = {
  /**
   * Orchestrator tick time (epoch ms). Drives sub-minute policy such as
   * {@link computeShouldRunPredictionFallback} (seconds-of-minute), not “trip-only” time.
   */
  tickStartedAt: number;
};

/**
 * Computes trip lifecycle data for one pass: anchors wall-clock policy and
 * builds {@link VesselTripsComputeBundle}.
 *
 * @param input - Converted locations and preloaded active trips
 * @param deps - Trip builders and schedule-backed adapters (from
 *   {@link createDefaultProcessVesselTripsDeps} in production)
 * @param options - **Required** tick anchor (see {@link VesselTripsWithClockOptions})
 * @returns **`tickStartedAt`** is an echo of `options.tickStartedAt` for convenience;
 *   authoritative orchestrator time is the value passed in, not invented here.
 */
export const computeVesselTripsWithClock = async (
  input: {
    convexLocations: ReadonlyArray<ConvexVesselLocation>;
    activeTrips: ReadonlyArray<
      ConvexVesselTrip | ConvexVesselTripWithPredictions
    >;
  },
  deps: ProcessVesselTripsDeps,
  options: VesselTripsWithClockOptions
): Promise<VesselTripsWithClock> => {
  const { tickStartedAt } = options;

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
