/**
 * Domain tick pipeline: parallel location persistence and trip lifecycle plus
 * timeline writes, with branch-level error isolation.
 */

import {
  computeShouldRunPredictionFallback,
  type VesselTripsTickResult,
} from "domain/vesselTrips";
import { isTripEligibleLocation } from "./passengerTerminalEligibility";
import type {
  VesselOrchestratorTickDeps,
  VesselOrchestratorTickInput,
  VesselOrchestratorTickResult,
} from "./types";

/**
 * Run post-fetch orchestration for one tick: filter trip-eligible locations,
 * fan out location storage vs trip branch (lifecycle then timeline writes), and
 * aggregate branch results.
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
    try {
      tripResult = await deps.processVesselTrips(
        tripEligibleLocations,
        tickStartedAt,
        activeTrips,
        processOptions
      );
    } catch (e) {
      console.error("processVesselTrips failed:", toError(e));
      throw e;
    }
    try {
      await deps.applyTickEventWrites(tripResult.tickEventWrites);
    } catch (e) {
      console.error("applyTickEventWrites failed:", toError(e));
      throw e;
    }
  };

  const branchResults: [
    PromiseSettledResult<void>,
    PromiseSettledResult<void>,
  ] = await Promise.allSettled([
    deps.persistLocations(convexLocations),
    runTripLifecycleAndTimeline(),
  ]);

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

  return {
    locationsSuccess: locationsResult.status === "fulfilled",
    tripsSuccess: tripsResult.status === "fulfilled",
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  };
};

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
