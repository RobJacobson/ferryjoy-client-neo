/**
 * Orchestrator trip writes: optional completion + active upsert only.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { stripVesselTripPredictions } from "domain/vesselOrchestration/updateVesselTrip";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Persists one completed vessel trip row.
 *
 * @param ctx - Mutation context
 * @param completedVesselTrip - Completed trip row for archival table
 */
export const persistCompletedVesselTrip = async (
  ctx: ActionCtx,
  completedVesselTrip: ConvexVesselTrip
): Promise<void> => {
  const completedTrip = stripVesselTripPredictions(completedVesselTrip);
  await ctx.runMutation(
    internal.functions.vesselTrips.mutations.insertCompletedVesselTripRow,
    { completedTrip }
  );
};

/**
 * Persists one active vessel trip row.
 *
 * @param ctx - Mutation context
 * @param activeVesselTrip - Active trip row for active table upsert
 */
export const persistActiveVesselTrip = async (
  ctx: ActionCtx,
  activeVesselTrip: ConvexVesselTrip
): Promise<void> => {
  const activeTrip = stripVesselTripPredictions(activeVesselTrip);
  await ctx.runMutation(
    internal.functions.vesselTrips.mutations.upsertActiveVesselTripRow,
    { activeTrip }
  );
};
