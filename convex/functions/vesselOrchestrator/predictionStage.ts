/**
 * Prediction-stage helpers for the vessel orchestrator.
 *
 * This keeps changed-trip gating and ML preload work near each other so the
 * main action file can stay focused on top-level ping control flow.
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

type PredictionStageInputs = {
  activeTrip?: ConvexVesselTrip;
  completedHandoff?: CompletedArrivalHandoff;
};

type PredictionStageResult = {
  predictionRows: ReadonlyArray<VesselTripPredictionProposal>;
  mlTimelineOverlays: ReadonlyArray<MlTimelineOverlay>;
};

/**
 * Runs prediction work only for vessels whose durable trip facts changed.
 *
 * @param ctx - Action context for prediction model preload
 * @param predictionInputs - Changed-trip active row plus optional completed handoff
 * @returns Flat prediction rows and timeline ML handoffs for persistence
 */
export const runPredictionStage = async (
  ctx: ActionCtx,
  predictionInputs: PredictionStageInputs
): Promise<PredictionStageResult> => {
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
 * Builds terminal-pair model-load requests for this prediction pass.
 *
 * @param activeTrip - Active trip from this ping
 * @param completedHandoff - Completed rollover fact from the trip stage
 * @returns Distinct terminal-pair requests with model types merged per pair
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
 * Loads production ML model parameters needed for the current prediction pass.
 *
 * @param ctx - Convex action context for prediction model query
 * @param activeTrip - Active trip to evaluate this ping
 * @param completedHandoff - Completed rollover handoff from the trip stage
 * @returns Terminal-pair keyed production model payloads (or empty context)
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
