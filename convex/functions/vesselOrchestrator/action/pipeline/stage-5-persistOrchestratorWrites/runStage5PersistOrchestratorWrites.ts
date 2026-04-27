/**
 * Stage #5: persist per-vessel orchestrator writes.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { RunUpdateVesselTimelineOutput } from "domain/vesselOrchestration/updateTimeline";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";
import type { UpdatedTrips } from "../stage-2-updateVesselTrip/tripWrites";

type RunStage5PersistOrchestratorWritesArgs = {
  updatedTrips: UpdatedTrips;
  predictionRows: ReadonlyArray<VesselTripPredictionProposal>;
  timelineRows: RunUpdateVesselTimelineOutput;
};

/**
 * Runs stage #5 for one vessel branch.
 *
 * @param ctx - Convex action context used to run the persistence mutation
 * @param args - Aggregated trip, prediction, and timeline writes for persistence
 * @returns Resolves after mutation write application
 */
export const runStage5PersistOrchestratorWrites = async (
  ctx: ActionCtx,
  {
    updatedTrips,
    predictionRows,
    timelineRows,
  }: RunStage5PersistOrchestratorWritesArgs
): Promise<void> => {
  // Keep mutation contract stable while Stage 2 adopts domain-first naming.
  const tripWrites = {
    completedTripWrite: updatedTrips.completedVesselTrip,
    activeTripUpsert: updatedTrips.activeVesselTrip,
    actualDockWrite: updatedTrips.actualDockWrite,
    predictedDockWrite: updatedTrips.predictedDockWrite,
  };
  await ctx.runMutation(
    internal.functions.vesselOrchestrator.mutation.mutations
      .persistPerVesselOrchestratorWrites,
    {
      tripWrites,
      predictionRows: Array.from(predictionRows),
      actualEvents: timelineRows.actualEvents,
      predictedEvents: timelineRows.predictedEvents,
    }
  );
};
