/**
 * Stage #2: compute sparse trip writes for one location update.
 */

import type {
  CompletedArrivalHandoff,
  ScheduleContinuityAccess,
} from "domain/vesselOrchestration/shared";
import { updateVesselTrip } from "domain/vesselOrchestration/updateVesselTrip";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  buildCompletionTripEvents,
  buildUpdatedTripsForVessel,
  type UpdatedTrips,
} from "./tripWrites";

export type Stage2PredictionInputs = {
  activeTrip?: ConvexVesselTrip;
  completedHandoff?: CompletedArrivalHandoff;
};

export type RunStage2UpdateVesselTripResult = {
  updatedTrips: UpdatedTrips;
  predictionInputs: Stage2PredictionInputs;
};

/**
 * Runs stage #2 for one vessel branch.
 *
 * @param locationUpdate - Normalized vessel location for this loop iteration
 * @param existingActiveTrip - Existing active trip row for the vessel
 * @param scheduleAccess - Continuity lookup adapter for trip-field inference
 * @returns Sparse write bundle, or `null` when no trip rows changed
 */
export const runStage2UpdateVesselTrip = async (
  locationUpdate: ConvexVesselLocation,
  existingActiveTrip: ConvexVesselTrip | undefined,
  scheduleAccess: ScheduleContinuityAccess
): Promise<RunStage2UpdateVesselTripResult | null> => {
  const tripUpdate = await updateVesselTrip({
    vesselLocation: locationUpdate,
    existingActiveTrip,
    scheduleAccess,
  });
  const tripRowsChanged =
    tripUpdate.activeVesselTripUpdate !== undefined ||
    tripUpdate.completedVesselTripUpdate !== undefined;
  if (!tripRowsChanged) {
    return null;
  }

  const activeTrip = tripUpdate.activeVesselTripUpdate;
  const completedHandoff =
    tripUpdate.completedVesselTripUpdate === undefined ||
    tripUpdate.activeVesselTripUpdate === undefined ||
    existingActiveTrip === undefined
      ? undefined
      : {
          existingTrip: existingActiveTrip,
          tripToComplete: tripUpdate.completedVesselTripUpdate,
          events: buildCompletionTripEvents(
            existingActiveTrip,
            tripUpdate.completedVesselTripUpdate
          ),
          scheduleTrip: tripUpdate.activeVesselTripUpdate,
        };

  return {
    updatedTrips: buildUpdatedTripsForVessel({
      existingActiveTrip,
      activeVesselTrip: tripUpdate.activeVesselTripUpdate,
      completedVesselTrip: tripUpdate.completedVesselTripUpdate,
    }),
    predictionInputs: {
      activeTrip,
      completedHandoff,
    },
  };
};
