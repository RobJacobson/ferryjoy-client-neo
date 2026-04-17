/**
 * Domain tick pipeline: parallel location persistence and trip lifecycle plus
 * timeline writes, with branch-level error isolation.
 *
 * Four operational concerns (names align with `architecture.md` §10):
 * - **updateVesselLocations** — `deps.persistLocations`
 * - **updateVesselTrips** — `deps.processVesselTrips` (lifecycle; **updateVesselPredictions**
 *   runs inside this step as `applyVesselPredictions` after `buildTripCore`, not as a
 *   separate orchestrator branch)
 * - **updateTimeline** — `deps.applyTickEventWrites` (runs after the trip step)
 *
 * `Promise.allSettled` runs **updateVesselLocations** in parallel with a branch
 * that runs **updateVesselTrips** then **updateTimeline** in sequence.
 */

import {
  computeShouldRunPredictionFallback,
  type VesselTripsTickResult,
} from "domain/vesselOrchestration/updateVesselTrips";
import type {
  VesselOrchestratorTickDeps,
  VesselOrchestratorTickInput,
  VesselOrchestratorTickMetrics,
  VesselOrchestratorTickResult,
} from "./types";
import { isTripEligibleLocation } from "./updateVesselTrips";

/**
 * Monotonic millisecond clock for duration sampling. Prefers `performance.now`
 * when available; falls back to `Date.now` if `performance` is missing.
 *
 * @returns Opaque timestamp — subtract only from values from this same function
 */
const nowMs = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

/**
 * Run post-fetch orchestration for one tick: filter trip-eligible locations,
 * fan out location storage vs trip branch (lifecycle then timeline writes), and
 * aggregate branch results.
 *
 * `deps` maps: `persistLocations` → **updateVesselLocations**;
 * `processVesselTrips` → **updateVesselTrips** (includes **updateVesselPredictions** /
 *   `applyVesselPredictions` on the build path); `applyTickEventWrites` →
 * **updateTimeline** (input: `tripResult.tickEventWrites`).
 *
 * Emits one structured `[VesselOrchestratorTick]` log line per invocation with
 * per-branch durations (`tickMetrics`) for observability (track 5A).
 *
 * @param input - Converted locations, terminal allow-list, tick time, active trips
 * @param deps - Injected persistence and trip/timeline adapters
 * @returns Same success envelope as the orchestrator action (without fetch errors)
 */
export const runVesselOrchestratorTick = async (
  input: VesselOrchestratorTickInput,
  deps: VesselOrchestratorTickDeps
): Promise<VesselOrchestratorTickResult> => {
  const errors: NonNullable<VesselOrchestratorTickResult["errors"]> = {};
  const tickMetrics: VesselOrchestratorTickMetrics = {};

  const {
    convexLocations,
    passengerTerminalAbbrevs,
    tickStartedAt,
    activeTrips,
  } = input;

  const tripEligibleLocations = convexLocations.filter((location) =>
    isTripEligibleLocation(location, passengerTerminalAbbrevs)
  );

  const processOptions = {
    shouldRunPredictionFallback:
      computeShouldRunPredictionFallback(tickStartedAt),
  };

  const runTripLifecycleAndTimeline = async () => {
    let tripResult: VesselTripsTickResult;
    const tProcess = nowMs();
    try {
      tripResult = await deps.processVesselTrips(
        tripEligibleLocations,
        tickStartedAt,
        activeTrips,
        processOptions
      );
    } catch (e) {
      tickMetrics.processVesselTripsMs = elapsedMs(tProcess);
      console.error("processVesselTrips failed:", toError(e));
      throw e;
    }
    tickMetrics.processVesselTripsMs = elapsedMs(tProcess);

    const tTimeline = nowMs();
    try {
      await deps.applyTickEventWrites(tripResult.tickEventWrites);
    } catch (e) {
      tickMetrics.applyTickEventWritesMs = elapsedMs(tTimeline);
      console.error("applyTickEventWrites failed:", toError(e));
      throw e;
    }
    tickMetrics.applyTickEventWritesMs = elapsedMs(tTimeline);
  };

  const runLocations = async () => {
    const t0 = nowMs();
    try {
      await deps.persistLocations(convexLocations);
    } catch (e) {
      tickMetrics.persistLocationsMs = elapsedMs(t0);
      throw e;
    }
    tickMetrics.persistLocationsMs = elapsedMs(t0);
  };

  const branchResults: [
    PromiseSettledResult<void>,
    PromiseSettledResult<void>,
  ] = await Promise.allSettled([runLocations(), runTripLifecycleAndTimeline()]);

  const [locationsResult, tripsResult] = branchResults;

  if (locationsResult.status === "rejected") {
    const err = toError(locationsResult.reason);
    errors.locations = { message: err.message, stack: err.stack };
    console.error("updateVesselLocations failed:", err);
  }

  if (tripsResult.status === "rejected") {
    const err = toError(tripsResult.reason);
    errors.trips = { message: err.message, stack: err.stack };
  }

  const locationsSuccess = locationsResult.status === "fulfilled";
  const tripsSuccess = tripsResult.status === "fulfilled";

  logVesselOrchestratorTickLine({
    locationsSuccess,
    tripsSuccess,
    tickMetrics,
    tickStartedAt,
  });

  return {
    locationsSuccess,
    tripsSuccess,
    tickMetrics,
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  };
};

/**
 * Writes one JSON line for log aggregation (durations, branch outcomes).
 *
 * @param payload - Success flags, timings, and tick clock
 */
const logVesselOrchestratorTickLine = (payload: {
  locationsSuccess: boolean;
  tripsSuccess: boolean;
  tickMetrics: VesselOrchestratorTickMetrics;
  tickStartedAt: number;
}): void => {
  console.log(
    `[VesselOrchestratorTick] ${JSON.stringify({
      kind: "VesselOrchestratorTick",
      ...payload,
    })}`
  );
};

/**
 * Elapsed milliseconds since `start` (same clock as `nowMs()`).
 *
 * @param start - Value from `nowMs()`
 * @returns Rounded whole milliseconds
 */
const elapsedMs = (start: number): number => Math.round(nowMs() - start);

/**
 * Coerce a `catch` binding or `PromiseSettledResult.reason` to `Error` so
 * branch-level logging and the orchestrator result shape stay consistent.
 *
 * @param value - Unknown rejection or throw value
 * @returns Original `Error` when applicable; otherwise `Error` with
 *   `String(value)` as the message
 */
const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));
