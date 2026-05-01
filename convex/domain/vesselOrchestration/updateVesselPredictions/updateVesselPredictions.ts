/**
 * One-ping prediction pass: ML overlay per active trip and completed handoff,
 * then derive table proposals.
 */

import type {
  CompletedArrivalHandoff,
  MlTimelineOverlay,
} from "domain/vesselOrchestration/updateTimeline";
import { buildCompletedHandoffKey } from "domain/vesselOrchestration/updateTimeline";
import type { ConvexVesselTripWithML } from "functions/vesselTrips/schemas";
import { applyVesselPredictionsFromLoadedModels } from "./applyVesselPredictions";
import type {
  RunUpdateVesselPredictionsInput,
  RunUpdateVesselPredictionsOutput,
} from "./contracts";
import { vesselTripPredictionProposalsFromMlTrip } from "./vesselTripPredictionProposalsFromMlTrip";

export type UpdateVesselPredictionsOutput = RunUpdateVesselPredictionsOutput & {
  mlTimelineOverlays: ReadonlyArray<MlTimelineOverlay>;
};

const buildCompletedOverlay = (
  handoff: CompletedArrivalHandoff,
  finalPredictedTrip: ConvexVesselTripWithML
): MlTimelineOverlay => ({
  vesselAbbrev: handoff.completedVesselTrip.VesselAbbrev,
  branch: "completed",
  completedHandoffKey: buildCompletedHandoffKey(
    handoff.completedVesselTrip.VesselAbbrev,
    handoff.completedVesselTrip,
    handoff.activeVesselTrip
  ),
  finalPredictedTrip,
});

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
  const { activeTrip, completedHandoff } = input.predictionStagePlan;
  const finalPredictedTrip = await applyVesselPredictionsFromLoadedModels(
    input.predictionContext.productionModelsByPair,
    activeTrip
  );
  const mlTimelineOverlays =
    completedHandoff === undefined
      ? [buildCurrentOverlay(finalPredictedTrip)]
      : [
          buildCompletedOverlay(completedHandoff, finalPredictedTrip),
          buildCurrentOverlay(finalPredictedTrip),
        ];
  const predictionRows =
    vesselTripPredictionProposalsFromMlTrip(finalPredictedTrip);

  return {
    predictionRows,
    mlTimelineOverlays,
  };
};
