/**
 * Derives vessel-trip prediction proposal rows and same-update timeline handoffs
 * from a trip update and optionally loaded prediction model parameters.
 */

import {
  buildCompletedHandoffKey,
  type PredictedTripTimelineHandoff,
} from "domain/vesselOrchestration/updateTimeline";
import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import { applyVesselPredictionsFromLoadedModels } from "./applyVesselPredictions";
import { getPredictionModelParametersFromTripUpdate } from "./getPredictionModelParametersFromTripUpdate";
import type {
  VesselTripPredictionDeps,
  VesselTripPredictionsFromTripUpdateResult,
} from "./types";
import { vesselTripPredictionProposalsFromMlTrip } from "./vesselTripPredictionProposalsFromMlTrip";

/**
 * Loads prediction parameters when needed, enriches the active trip with
 * phase-valid predictions, and returns persistence proposals plus timeline merge
 * handoffs for the same update.
 *
 * @param tripUpdate - Sparse trip rows from `updateVesselTrip` for this branch
 * @param deps - Async loader for **`getPredictionModelParameters`** query results
 * @returns Prediction table rows and handoffs consumed by `updateTimeline`
 */
export const getVesselTripPredictionsFromTripUpdate = async (
  tripUpdate: VesselTripUpdate,
  deps: VesselTripPredictionDeps
): Promise<VesselTripPredictionsFromTripUpdateResult> => {
  const activeTrip = tripUpdate.activeVesselTrip;
  const request = getPredictionModelParametersFromTripUpdate(tripUpdate);
  const predictionModelParametersByPairKey =
    request === null
      ? undefined
      : await deps.loadPredictionModelParameters(request);

  const finalPredictedTrip = await applyVesselPredictionsFromLoadedModels(
    predictionModelParametersByPairKey,
    activeTrip
  );

  const hasIncompleteCompletedLegContext =
    tripUpdate.existingVesselTrip === undefined ||
    tripUpdate.completedVesselTrip === undefined;

  const predictedTripTimelineHandoffs = hasIncompleteCompletedLegContext
    ? [buildCurrentTripTimelineHandoff(finalPredictedTrip)]
    : [
        buildCompletedTripTimelineHandoff(tripUpdate, finalPredictedTrip),
        buildCurrentTripTimelineHandoff(finalPredictedTrip),
      ];

  const predictionRows =
    vesselTripPredictionProposalsFromMlTrip(finalPredictedTrip);

  return {
    predictionRows,
    predictedTripTimelineHandoffs,
  };
};

/**
 * Builds the completed-leg branch handoff when this update closes out a trip
 * leg and advances the replacement active trip.
 *
 * @param tripUpdate - Must include `existingVesselTrip`, `completedVesselTrip`,
 *   and `activeVesselTrip`
 * @param finalPredictedTrip - Active trip after model fields are attached
 * @returns Handoff keyed for merge with timeline facts
 */
const buildCompletedTripTimelineHandoff = (
  tripUpdate: VesselTripUpdate,
  finalPredictedTrip: ConvexVesselTripWithML
): PredictedTripTimelineHandoff => {
  const completedHandoffKey = buildCompletedHandoffKey(
    (tripUpdate.completedVesselTrip as ConvexVesselTrip).VesselAbbrev,
    tripUpdate.completedVesselTrip as ConvexVesselTrip,
    tripUpdate.activeVesselTrip
  );

  return {
    vesselAbbrev: (tripUpdate.completedVesselTrip as ConvexVesselTrip)
      .VesselAbbrev,
    branch: "completed",
    completedHandoffKey,
    finalPredictedTrip,
  };
};

/**
 * Builds the current-branch handoff so timeline predicted writes use the same
 * enriched trip row as proposal rows.
 *
 * @param finalPredictedTrip - Active trip after model fields are attached
 * @returns Current-branch handoff for the vessel
 */
const buildCurrentTripTimelineHandoff = (
  finalPredictedTrip: ConvexVesselTripWithML
): PredictedTripTimelineHandoff => ({
  vesselAbbrev: finalPredictedTrip.VesselAbbrev,
  branch: "current",
  finalPredictedTrip,
});
