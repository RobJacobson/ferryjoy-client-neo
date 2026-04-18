/**
 * Functions-layer runner: domain trip write plan → apply mutations → timeline
 * projection input for one orchestrator tick.
 */

import type { ActionCtx } from "_generated/server";
import { buildTimelineTickProjectionInput } from "domain/vesselOrchestration/updateTimeline";
import {
  computeVesselTripTickWritePlan,
  type ProcessVesselTripsDeps,
  type ProcessVesselTripsOptions,
  type VesselTripsTickResult,
} from "domain/vesselOrchestration/updateVesselTrips";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { applyVesselTripTickWritePlan } from "functions/vesselTrips/applyVesselTripTickWritePlan";
import type {
  ConvexVesselTripWithPredictions,
  TickActiveTrip,
} from "functions/vesselTrips/schemas";

/**
 * Runs the vessel-trip tick branch: compute plan, apply persistence, assemble
 * timeline writes for `applyTickEventWrites`.
 *
 * @param ctx - Convex action context for trip mutations
 * @param locations - Vessel locations for this tick
 * @param tickStartedAt - Tick timestamp (ms)
 * @param deps - Trip build adapters and detectors (`createDefaultProcessVesselTripsDeps`)
 * @param activeTrips - Preloaded active trips for this tick
 * @param options - Optional prediction fallback policy (defaults to `{}`)
 * @returns Tick result for the orchestrator timeline branch
 */
export const runProcessVesselTripsTick = async (
  ctx: ActionCtx,
  locations: ReadonlyArray<ConvexVesselLocation>,
  tickStartedAt: number,
  deps: ProcessVesselTripsDeps,
  activeTrips: ReadonlyArray<TickActiveTrip | ConvexVesselTripWithPredictions>,
  options: ProcessVesselTripsOptions = {}
): Promise<VesselTripsTickResult> => {
  const { plan } = await computeVesselTripTickWritePlan(
    locations,
    tickStartedAt,
    deps,
    activeTrips,
    options
  );
  const { completedFacts, currentBranch } = await applyVesselTripTickWritePlan(
    ctx,
    plan
  );
  const tickEventWrites = buildTimelineTickProjectionInput({
    completedFacts,
    currentBranch,
    tickStartedAt,
  });

  return {
    tickStartedAt,
    tickEventWrites,
  };
};
