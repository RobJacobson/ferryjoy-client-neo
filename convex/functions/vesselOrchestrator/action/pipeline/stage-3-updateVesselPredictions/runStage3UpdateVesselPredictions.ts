/**
 * Stage #3: update vessel predictions for changed trip facts.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { formatTerminalPairKey } from "domain/ml/shared/config";
import type { ModelType } from "domain/ml/shared/types";
import type {
  CompletedArrivalHandoff,
  MlTimelineOverlay,
} from "domain/vesselOrchestration/shared";
import {
  predictionModelTypesForTrip,
  updateVesselPredictions,
  type VesselPredictionContext,
} from "domain/vesselOrchestration/updateVesselPredictions";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export type RunStage3UpdateVesselPredictionsInput = {
  activeTrip?: ConvexVesselTrip;
  completedHandoff?: CompletedArrivalHandoff;
};

export type RunStage3UpdateVesselPredictionsResult = {
  predictionRows: ReadonlyArray<VesselTripPredictionProposal>;
  mlTimelineOverlays: ReadonlyArray<MlTimelineOverlay>;
};

/**
 * Runs stage #3 for the current vessel branch.
 *
 * @param ctx - Convex action context used to load prediction model payloads
 * @param predictionInputs - Changed active trip plus optional completion handoff
 * @returns Prediction rows and ML timeline overlays for mutation persistence
 */
export const runStage3UpdateVesselPredictions = async (
  ctx: ActionCtx,
  predictionInputs: RunStage3UpdateVesselPredictionsInput
): Promise<RunStage3UpdateVesselPredictionsResult> => {
  if (
    predictionInputs.activeTrip === undefined &&
    predictionInputs.completedHandoff === undefined
  ) {
    return {
      predictionRows: [],
      mlTimelineOverlays: [],
    };
  }

  const predictionContext = await loadPredictionContext(
    ctx,
    predictionInputs.activeTrip,
    predictionInputs.completedHandoff
  );
  const activeTrips =
    predictionInputs.activeTrip === undefined
      ? []
      : [predictionInputs.activeTrip];
  const completedHandoffs =
    predictionInputs.completedHandoff === undefined
      ? []
      : [predictionInputs.completedHandoff];
  const predictionPingResult = await updateVesselPredictions({
    activeTrips,
    completedHandoffs,
    predictionContext,
  });

  return {
    predictionRows: predictionPingResult.predictionRows,
    mlTimelineOverlays: predictionPingResult.mlTimelineOverlays,
  };
};

/**
 * Builds model-load requests from the best trip evidence for this branch.
 *
 * @param activeTrip - Active trip update candidate for the current vessel
 * @param completedHandoff - Completion handoff when rollover happened this ping
 * @returns Terminal-pair requests with model types needed for prediction
 */
const buildPredictionContextRequests = (
  activeTrip: ConvexVesselTrip | undefined,
  completedHandoff: CompletedArrivalHandoff | undefined
): Array<{ pairKey: string; modelTypes: Array<ModelType> }> => {
  const candidateTrip = completedHandoff?.scheduleTrip ?? activeTrip;
  if (candidateTrip === undefined) {
    return [];
  }
  const modelTypes = predictionModelTypesForTrip(candidateTrip);
  if (modelTypes.length === 0) {
    return [];
  }
  const departing = candidateTrip.DepartingTerminalAbbrev;
  const arriving = candidateTrip.ArrivingTerminalAbbrev;
  if (departing === undefined || arriving === undefined) {
    return [];
  }
  return [
    {
      pairKey: formatTerminalPairKey(departing, arriving),
      modelTypes,
    },
  ];
};

/**
 * Loads production prediction context for the current branch inputs.
 *
 * @param ctx - Convex action context used for model parameter query
 * @param activeTrip - Active trip evidence for this branch
 * @param completedHandoff - Completion handoff evidence for this branch
 * @returns Prediction context keyed by terminal pair, or empty context
 */
const loadPredictionContext = async (
  ctx: ActionCtx,
  activeTrip: ConvexVesselTrip | undefined,
  completedHandoff: CompletedArrivalHandoff | undefined
): Promise<VesselPredictionContext> => {
  const requests = buildPredictionContextRequests(activeTrip, completedHandoff);
  if (requests.length === 0) {
    return {};
  }

  const productionModelsByPair = await ctx.runQuery(
    internal.functions.predictions.queries.getProductionModelParametersForPing,
    { requests }
  );
  return { productionModelsByPair };
};
