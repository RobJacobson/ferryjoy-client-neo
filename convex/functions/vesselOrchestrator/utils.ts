/**
 * Convex transport wiring for the vessel orchestrator (`runQuery` / `runMutation`).
 *
 * **Boundary:** `convex/functions` only—domain code never imports `ActionCtx`.
 * These objects exist so domain helpers receive plain interfaces ({@link VesselTripTableMutations},
 * {@link VesselTripPredictionModelAccess}) implemented with Convex.
 *
 * Sequential orchestration steps live in {@link actions.ts}.
 */

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import { createVesselTripPredictionModelAccess } from "functions/predictions/createVesselTripPredictionModelAccess";
import type { VesselTripTableMutations } from "./persistVesselTripWriteSet";

/**
 * Bundles Convex `runMutation` bindings used by `updateVesselOrchestrator` steps.
 */
export const createVesselOrchestratorConvexBindings = (
  ctx: ActionCtx
): {
  vesselTripMutations: VesselTripTableMutations;
  predictionModelQueries: VesselTripPredictionModelAccess;
} => ({
  vesselTripMutations: createVesselTripTableMutations(ctx),
  predictionModelQueries: createVesselTripPredictionModelAccess(ctx),
});

/** Convex `runMutation` bindings for {@link persistVesselTripWriteSet}. */
export const createVesselTripTableMutations = (
  ctx: ActionCtx
): VesselTripTableMutations => ({
  completeAndStartNewTrip: (args) =>
    ctx.runMutation(
      api.functions.vesselTrips.mutations.completeAndStartNewTrip,
      args
    ),
  upsertVesselTripsBatch: (args) =>
    ctx.runMutation(
      api.functions.vesselTrips.mutations.upsertVesselTripsBatch,
      args
    ),
  setDepartNextActualsForMostRecentCompletedTrip: (args) =>
    ctx.runMutation(
      api.functions.vesselTrips.mutations
        .setDepartNextActualsForMostRecentCompletedTrip,
      args
    ),
});
