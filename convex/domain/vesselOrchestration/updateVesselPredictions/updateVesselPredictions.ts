/**
 * One-ping prediction pass: ML overlay per active trip and completed handoff,
 * then derive table proposals.
 */

import {
  buildCompletedHandoffKey,
  type CompletedArrivalHandoff,
  type MlTimelineOverlay,
} from "domain/vesselOrchestration/updateTimeline";
import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import { applyVesselPredictionsFromLoadedModels } from "./applyVesselPredictions";
import type {
  RunUpdateVesselPredictionsInput,
  RunUpdateVesselPredictionsOutput,
} from "./types";
import { vesselTripPredictionProposalsFromMlTrip } from "./vesselTripPredictionProposalsFromMlTrip";

export type UpdateVesselPredictionsOutput = RunUpdateVesselPredictionsOutput & {
  mlTimelineOverlays: ReadonlyArray<MlTimelineOverlay>;
};

/**
 * Only call when `tripUpdate` has both `existingVesselTrip` and
 * `completedVesselTrip` (see caller guard).
 */
const buildCompletedOverlay = (
  tripUpdate: VesselTripUpdate,
  finalPredictedTrip: ConvexVesselTripWithML
): MlTimelineOverlay => {
  const handoff: CompletedArrivalHandoff = {
    existingVesselTrip: tripUpdate.existingVesselTrip as ConvexVesselTrip,
    completedVesselTrip: tripUpdate.completedVesselTrip as ConvexVesselTrip,
    activeVesselTrip: tripUpdate.activeVesselTrip,
  };

  return {
    vesselAbbrev: handoff.completedVesselTrip.VesselAbbrev,
    branch: "completed",
    completedHandoffKey: buildCompletedHandoffKey(
      handoff.completedVesselTrip.VesselAbbrev,
      handoff.completedVesselTrip,
      handoff.activeVesselTrip
    ),
    finalPredictedTrip,
  };
};

const buildCurrentOverlay = (
  finalPredictedTrip: ConvexVesselTripWithML
): MlTimelineOverlay => ({
  vesselAbbrev: finalPredictedTrip.VesselAbbrev,
  branch: "current",
  finalPredictedTrip,
});

/**
 * Canonical predictions entrypoint for orchestrator callers.
 *
 * Consumes the already-derived Stage 4 plan, computes the active/replacement
 * trip's ML fields once, and emits both prediction rows and timeline overlays.
 *
 * @param input - Stage plan plus preloaded production model context
 * @returns Prediction rows and timeline ML overlays for this ping
 */
export const updateVesselPredictions = async (
  input: RunUpdateVesselPredictionsInput
): Promise<UpdateVesselPredictionsOutput> => {
  const tripUpdate = input.tripUpdate;
  const activeTrip = tripUpdate.activeVesselTrip;
  const hasUndefinedCompletedLegField =
    tripUpdate.existingVesselTrip === undefined ||
    tripUpdate.completedVesselTrip === undefined;
  const finalPredictedTrip = await applyVesselPredictionsFromLoadedModels(
    input.predictionContext.productionModelsByPair,
    activeTrip
  );
  const mlTimelineOverlays = hasUndefinedCompletedLegField
    ? [buildCurrentOverlay(finalPredictedTrip)]
    : [
        buildCompletedOverlay(tripUpdate, finalPredictedTrip),
        buildCurrentOverlay(finalPredictedTrip),
      ];
  const predictionRows =
    vesselTripPredictionProposalsFromMlTrip(finalPredictedTrip);

  return {
    predictionRows,
    mlTimelineOverlays,
  };
};
