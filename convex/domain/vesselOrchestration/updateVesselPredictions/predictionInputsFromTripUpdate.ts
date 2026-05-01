/**
 * Derive prediction inputs from a sparse {@link VesselTripUpdate}.
 *
 * Pure helper colocated with `updateVesselPredictions` so the predictions
 * domain owns its own input derivation from upstream trip rows.
 */

import type { CompletedArrivalHandoff } from "domain/vesselOrchestration/updateTimeline";
import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { buildPredictionStagePlan } from "./predictionStagePlan";

export type PredictionInputsFromTripUpdate = {
  activeTrip: ConvexVesselTrip;
  completedHandoff?: CompletedArrivalHandoff;
};

/**
 * Builds prediction inputs from existing and updated trip rows.
 *
 * @param tripUpdate - Sparse trip update rows for this ping branch
 * @returns Active trip and completion handoff inputs for the predictions pass
 */
export const predictionInputsFromTripUpdate = (
  tripUpdate: VesselTripUpdate
): PredictionInputsFromTripUpdate => {
  const { activeTrip, completedHandoff } = buildPredictionStagePlan(tripUpdate);
  return {
    activeTrip,
    completedHandoff,
  };
};
