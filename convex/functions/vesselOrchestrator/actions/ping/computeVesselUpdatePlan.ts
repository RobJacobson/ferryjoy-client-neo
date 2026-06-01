/**
 * Action-side coordinator for one changed vessel: trip compute, prediction
 * enrichment, event projection, and persistence-ready plan assembly.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { projectEventsFromTripDelta } from "domain/vesselOrchestration/updateEvents";
import type { UpdateVesselTripDbAccess } from "domain/vesselOrchestration/updateVesselTrip";
import {
  stripVesselTripPredictions,
  updateVesselTrip,
} from "domain/vesselOrchestration/updateVesselTrip";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexPredictedDockWriteBatch } from "functions/events/eventsPredicted/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { getVesselTripPredictionsForTripUpdate } from "./updateVesselPredictions";
import { createUpdateVesselTripDbAccess } from "./updateVesselTrip";

/**
 * Persistence-ready plan for one changed vessel on one orchestrator ping.
 */
type VesselUpdatePlan = {
  vesselAbbrev: string;
  existingVesselTrip?: ConvexVesselTrip;
  activeVesselTrip: ConvexVesselTrip;
  completedVesselTrip?: ConvexVesselTrip;
  actualEvents: ConvexActualDockEvent[];
  predictedEvents: ConvexPredictedDockWriteBatch[];
  updateLeaveDockEventPatch?: {
    vesselAbbrev: string;
    depBoundaryKey: string;
    actualDepartMs: number;
  };
};

type ComputeVesselUpdatePlanArgs = {
  pingStartedAt: number;
  vesselLocation: ConvexVesselLocation;
  existingActiveTrip: ConvexVesselTrip | undefined;
  tripDbAccess: UpdateVesselTripDbAccess;
};

/**
 * Computes one persistence-ready vessel plan for a changed location row.
 *
 * Runs trip compute, best-effort prediction enrichment, direct event projection,
 * and storage stripping in the order required for semantic parity with the
 * prior multi-stage orchestrator loop. Returns null when trip compute finds no
 * substantive durable change.
 *
 * @param ctx - Convex action context used for prediction model loading
 * @param args - Ping context, changed location, existing active trip, and schedule access
 * @returns Persistence-ready plan, or null when no durable writes are needed
 */
const computeVesselUpdatePlan = async (
  ctx: ActionCtx,
  {
    pingStartedAt,
    vesselLocation,
    existingActiveTrip,
    tripDbAccess,
  }: ComputeVesselUpdatePlanArgs
): Promise<VesselUpdatePlan | null> => {
  const tripUpdate = await updateVesselTrip(
    vesselLocation,
    existingActiveTrip,
    tripDbAccess
  );

  if (tripUpdate === null) {
    return null;
  }

  const { enrichedActiveVesselTrip } =
    await getVesselTripPredictionsForTripUpdate(ctx, tripUpdate);

  const eventProjection = projectEventsFromTripDelta({
    pingStartedAt,
    tripUpdate,
    enrichedActiveVesselTrip,
  });

  return {
    vesselAbbrev: tripUpdate.vesselAbbrev,
    existingVesselTrip: tripUpdate.existingVesselTrip,
    activeVesselTrip: stripVesselTripPredictions(tripUpdate.activeVesselTrip),
    completedVesselTrip:
      tripUpdate.completedVesselTrip === undefined
        ? undefined
        : stripVesselTripPredictions(tripUpdate.completedVesselTrip),
    actualEvents: eventProjection.actualEvents,
    predictedEvents: eventProjection.predictedEvents,
    updateLeaveDockEventPatch: eventProjection.updateLeaveDockEventPatch,
  };
};

/**
 * Persists one non-null vessel update plan through the aggregate mutation.
 *
 * @param ctx - Convex action context
 * @param plan - Persistence-ready rows for one changed vessel
 * @returns Resolves when the mutation completes
 */
const persistVesselUpdatePlan = async (
  ctx: ActionCtx,
  plan: VesselUpdatePlan
): Promise<null> =>
  ctx.runMutation(
    internal.functions.vesselOrchestrator.mutations.orchestratorPersistMutations
      .persistVesselUpdates,
    {
      vesselAbbrev: plan.vesselAbbrev,
      activeVesselTrip: plan.activeVesselTrip,
      completedVesselTrip: plan.completedVesselTrip,
      actualEvents: plan.actualEvents,
      predictedEvents: plan.predictedEvents,
      updateLeaveDockEventPatch: plan.updateLeaveDockEventPatch,
    }
  );

export type { ComputeVesselUpdatePlanArgs, VesselUpdatePlan };
export {
  computeVesselUpdatePlan,
  createUpdateVesselTripDbAccess,
  persistVesselUpdatePlan,
};
