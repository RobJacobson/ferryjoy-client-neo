/**
 * Derive prediction inputs from a sparse {@link VesselTripUpdate}.
 *
 * Pure helper colocated with `updateVesselPredictions` so the predictions
 * domain owns its own input derivation from upstream trip rows.
 */

import type { CompletedArrivalHandoff } from "domain/vesselOrchestration/updateTimeline";
import {
  buildCompletionTripEvents,
  type VesselTripUpdate,
} from "domain/vesselOrchestration/updateVesselTrip";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export type PredictionInputsFromTripUpdate = {
  activeTrip?: ConvexVesselTrip;
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
  const existingActiveTrip = tripUpdate.existingActiveTrip;
  const activeTrip = tripUpdate.activeVesselTripUpdate;
  const completedTrip = tripUpdate.completedVesselTripUpdate;
  if (existingActiveTrip === undefined || completedTrip === undefined) {
    return {
      activeTrip,
      completedHandoff: undefined,
    };
  }
  return {
    activeTrip,
    completedHandoff: {
      existingTrip: existingActiveTrip,
      tripToComplete: completedTrip,
      events: buildCompletionTripEvents(existingActiveTrip, completedTrip),
      scheduleTrip: activeTrip ?? completedTrip,
    },
  };
};
