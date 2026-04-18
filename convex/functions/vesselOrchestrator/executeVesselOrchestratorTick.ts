/**
 * Functions-owned vessel orchestrator tick: parallel location persistence versus
 * trip lifecycle plus timeline writes, with branch-level error isolation.
 *
 * Production: {@link updateVesselOrchestrator} in `actions.ts` calls this after
 * fetch and read-model load. Domain `runVesselOrchestratorTick` was removed in
 * Step D; see
 * `docs/engineering/vessel-orchestrator-functions-owned-orchestration-memo.md`
 * for layering and migration context.
 */

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { runUpdateVesselLocationsTick } from "domain/vesselOrchestration/updateVesselLocations";
import {
  computeShouldRunPredictionFallback,
  createDefaultProcessVesselTripsDeps,
  isTripEligibleLocation,
  type VesselTripsTickResult,
} from "domain/vesselOrchestration/updateVesselTrips";
import { createVesselTripPredictionModelAccess } from "functions/predictions/createVesselTripPredictionModelAccess";
import { applyTickEventWrites } from "./applyTickEventWrites";
import { createScheduledSegmentLookup } from "./createScheduledSegmentLookup";
import { runProcessVesselTripsTick } from "./runProcessVesselTripsTick";
import type {
  VesselOrchestratorTickInput,
  VesselOrchestratorTickResult,
} from "./types";
import {
  elapsedMs,
  logVesselOrchestratorTickLine,
  nowMs,
  toError,
} from "./vesselOrchestratorTickHelpers";

/**
 * Runs post-fetch orchestration for one tick using `ActionCtx`: filter
 * trip-eligible locations, fan out location storage versus trip branch (lifecycle
 * then timeline writes), and aggregate branch results.
 *
 * @param ctx - Convex action context for mutations and queries
 * @param input - Converted locations, terminal allow-list, tick time, active trips
 * @returns Same success envelope as the orchestrator action (without fetch errors)
 */
export const executeVesselOrchestratorTick = async (
  ctx: ActionCtx,
  input: VesselOrchestratorTickInput
): Promise<VesselOrchestratorTickResult> => {
  const errors: NonNullable<VesselOrchestratorTickResult["errors"]> = {};
  const tickMetrics: VesselOrchestratorTickResult["tickMetrics"] = {};

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

  const processVesselTripsDeps = createDefaultProcessVesselTripsDeps(
    createScheduledSegmentLookup(ctx),
    createVesselTripPredictionModelAccess(ctx)
  );

  const runTripLifecycleAndTimeline = async () => {
    let tripResult: VesselTripsTickResult;
    const tProcess = nowMs();
    try {
      tripResult = await runProcessVesselTripsTick(
        ctx,
        tripEligibleLocations,
        tickStartedAt,
        processVesselTripsDeps,
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
      await applyTickEventWrites(ctx, tripResult.tickEventWrites);
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
      await runUpdateVesselLocationsTick(convexLocations, (args) =>
        ctx.runMutation(api.functions.vesselLocation.mutations.bulkUpsert, args)
      );
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
