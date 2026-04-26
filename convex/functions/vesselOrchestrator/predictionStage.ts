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
import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrips";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

type PredictionStageInputs = {
  activeTrips: ReadonlyArray<ConvexVesselTrip>;
  completedHandoffs: ReadonlyArray<CompletedArrivalHandoff>;
};

type PredictionStageResult = {
  predictionRows: ReadonlyArray<VesselTripPredictionProposal>;
  mlTimelineOverlays: ReadonlyArray<MlTimelineOverlay>;
};

/**
 * Runs prediction work only for vessels whose durable trip facts changed.
 *
 * @param ctx - Action context for prediction model preload
 * @param predictionInputs - Changed-trip active rows plus completed handoffs
 * @returns Flat prediction rows and timeline ML handoffs for persistence
 */
export const runPredictionStage = async (
  ctx: ActionCtx,
  predictionInputs: PredictionStageInputs
): Promise<PredictionStageResult> => {
  if (
    predictionInputs.activeTrips.length === 0 &&
    predictionInputs.completedHandoffs.length === 0
  ) {
    return {
      predictionRows: [],
      mlTimelineOverlays: [],
    };
  }

  const predictionContext = await loadPredictionContext(
    ctx,
    predictionInputs.activeTrips,
    predictionInputs.completedHandoffs
  );
  const predictionPingResult = await updateVesselPredictions({
    activeTrips: predictionInputs.activeTrips,
    completedHandoffs: predictionInputs.completedHandoffs,
    predictionContext,
  });

  return {
    predictionRows: predictionPingResult.predictionRows,
    mlTimelineOverlays: predictionPingResult.mlTimelineOverlays,
  };
};

/**
 * Filters the trip stage down to the subset that needs prediction work.
 *
 * @param tripUpdates - Per-vessel trip updates
 * @param completedHandoffs - Completed rollover handoffs from persistence planning
 * @returns Narrow prediction-stage inputs derived directly from changed trip updates
 */
export const buildPredictionStageInputs = (
  tripUpdates: ReadonlyArray<VesselTripUpdate>,
  completedHandoffs: ReadonlyArray<CompletedArrivalHandoff>
): PredictionStageInputs => {
  const activeTrips: Array<ConvexVesselTrip> = [];
  const changedVesselAbbrevs = new Set<string>();

  for (const tripUpdate of tripUpdates) {
    const changed =
      tripUpdate.activeVesselTripUpdate !== undefined ||
      tripUpdate.completedVesselTripUpdate !== undefined;
    if (!changed) {
      continue;
    }

    changedVesselAbbrevs.add(tripUpdate.vesselAbbrev);
    if (tripUpdate.activeVesselTripUpdate !== undefined) {
      activeTrips.push(tripUpdate.activeVesselTripUpdate);
    }
  }

  return {
    activeTrips,
    completedHandoffs: completedHandoffs.filter((handoff) =>
      changedVesselAbbrevs.has(handoff.tripToComplete.VesselAbbrev)
    ),
  };
};

/**
 * Builds terminal-pair model-load requests for this prediction pass.
 *
 * @param activeTrips - Active trips from this ping
 * @param completedHandoffs - Completed rollover facts from the trip stage
 * @returns Distinct terminal-pair requests with model types merged per pair
 */
const buildPredictionContextRequests = (
  activeTrips: ReadonlyArray<ConvexVesselTrip>,
  completedHandoffs: ReadonlyArray<CompletedArrivalHandoff>
): Array<{ pairKey: string; modelTypes: Array<ModelType> }> => {
  const requestMap = new Map<string, Set<ModelType>>();
  const candidateTripsForPrediction = [
    ...completedHandoffs.map((handoff) => handoff.scheduleTrip),
    ...activeTrips,
  ];

  for (const candidateTrip of candidateTripsForPrediction) {
    const candidateModelTypes = predictionModelTypesForTrip(candidateTrip);
    if (candidateModelTypes.length === 0) {
      continue;
    }

    const departing = candidateTrip.DepartingTerminalAbbrev;
    const arriving = candidateTrip.ArrivingTerminalAbbrev;
    if (departing === undefined || arriving === undefined) {
      continue;
    }

    const pairKey = formatTerminalPairKey(departing, arriving);
    const modelTypes = requestMap.get(pairKey) ?? new Set<ModelType>();
    for (const modelType of candidateModelTypes) {
      modelTypes.add(modelType);
    }
    requestMap.set(pairKey, modelTypes);
  }

  return [...requestMap.entries()].map(([pairKey, modelTypes]) => ({
    pairKey,
    modelTypes: [...modelTypes],
  }));
};

/**
 * Loads production ML model parameters needed for the current prediction pass.
 *
 * @param ctx - Convex action context for prediction model query
 * @param activeTrips - Active trips to evaluate this ping
 * @param completedHandoffs - Completed rollover handoffs from the trip stage
 * @returns Terminal-pair keyed production model payloads (or empty context)
 */
const loadPredictionContext = async (
  ctx: ActionCtx,
  activeTrips: ReadonlyArray<ConvexVesselTrip>,
  completedHandoffs: ReadonlyArray<CompletedArrivalHandoff>
): Promise<VesselPredictionContext> => {
  const requests = buildPredictionContextRequests(
    activeTrips,
    completedHandoffs
  );
  if (requests.length === 0) {
    return {};
  }

  const productionModelsByPair = await ctx.runQuery(
    internal.functions.predictions.queries.getProductionModelParametersForPing,
    { requests }
  );
  return { productionModelsByPair };
};
