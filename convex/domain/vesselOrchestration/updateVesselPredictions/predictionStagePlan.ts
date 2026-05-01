/**
 * Single derivation point for the orchestrator prediction stage.
 */

import { formatTerminalPairKey } from "domain/ml/shared/config";
import type { ModelType } from "domain/ml/shared/types";
import type { CompletedArrivalHandoff } from "domain/vesselOrchestration/updateTimeline";
import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { predictionModelTypesForTrip } from "./predictionPolicy";

export type PredictionModelLoadRequest = {
  pairKey: string;
  modelTypes: Array<ModelType>;
};

export type PredictionStagePlan = {
  activeTrip: ConvexVesselTrip;
  completedHandoff?: CompletedArrivalHandoff;
  modelLoadRequest: PredictionModelLoadRequest | null;
};

const buildModelLoadRequestForTrip = (
  trip: ConvexVesselTrip
): PredictionModelLoadRequest | null => {
  const modelTypes = predictionModelTypesForTrip(trip);
  if (modelTypes.length === 0) {
    return null;
  }

  const departing = trip.DepartingTerminalAbbrev;
  const arriving = trip.ArrivingTerminalAbbrev;
  if (departing === undefined || arriving === undefined) {
    return null;
  }

  return {
    pairKey: formatTerminalPairKey(departing, arriving),
    modelTypes,
  };
};

export const buildPredictionStagePlan = (
  tripUpdate: VesselTripUpdate
): PredictionStagePlan => {
  const activeTrip = tripUpdate.activeVesselTripUpdate;
  const completedTrip = tripUpdate.completedVesselTripUpdate;
  const existingActiveTrip = tripUpdate.existingActiveTrip;
  const completedHandoff =
    existingActiveTrip === undefined || completedTrip === undefined
      ? undefined
      : {
          existingTrip: existingActiveTrip,
          tripToComplete: completedTrip,
          scheduleTrip: activeTrip,
        };

  return {
    activeTrip,
    completedHandoff,
    modelLoadRequest: buildModelLoadRequestForTrip(
      completedHandoff?.scheduleTrip ?? activeTrip
    ),
  };
};
