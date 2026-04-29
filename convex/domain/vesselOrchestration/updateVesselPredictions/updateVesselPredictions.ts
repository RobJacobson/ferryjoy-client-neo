/**
 * One-ping prediction pass: ML overlay per active trip and completed handoff,
 * then derive table proposals.
 */

import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type {
  CompletedArrivalHandoff,
  MlTimelineOverlay,
} from "domain/vesselOrchestration/updateTimeline";
import { buildCompletedHandoffKey } from "domain/vesselOrchestration/updateTimeline";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { applyVesselPredictions } from "./applyVesselPredictions";
import type {
  RunUpdateVesselPredictionsInput,
  RunUpdateVesselPredictionsOutput,
  VesselPredictionContext,
} from "./contracts";
import { predictionInputsFromTripUpdate } from "./predictionInputsFromTripUpdate";
import { vesselTripPredictionProposalsFromMlTrip } from "./vesselTripPredictionProposalsFromMlTrip";

export type UpdateVesselPredictionsOutput = RunUpdateVesselPredictionsOutput & {
  mlTimelineOverlays: ReadonlyArray<MlTimelineOverlay>;
};

const predictionModelAccessFromContext = (
  context: VesselPredictionContext
): VesselTripPredictionModelAccess => {
  const loadModelForProductionPair: VesselTripPredictionModelAccess["loadModelForProductionPair"] =
    async (pairKey, modelType) =>
      context.productionModelsByPair?.[pairKey]?.[modelType] ?? null;

  const loadModelsForProductionPairBatch: VesselTripPredictionModelAccess["loadModelsForProductionPairBatch"] =
    async (pairKey, modelTypes) =>
      Object.fromEntries(
        modelTypes.map((modelType) => [
          modelType,
          context.productionModelsByPair?.[pairKey]?.[modelType] ?? null,
        ])
      ) as Awaited<
        ReturnType<
          VesselTripPredictionModelAccess["loadModelsForProductionPairBatch"]
        >
      >;

  return {
    loadModelForProductionPair,
    loadModelsForProductionPairBatch,
  };
};

const buildPredictedCurrentTrip = async (
  trip: ConvexVesselTrip,
  modelAccess: VesselTripPredictionModelAccess
): Promise<MlTimelineOverlay> => {
  const finalPredictedTrip = await applyVesselPredictions(modelAccess, trip);

  return {
    vesselAbbrev: trip.VesselAbbrev,
    branch: "current",
    finalPredictedTrip,
  };
};

const buildPredictedCompletedHandoff = async (
  handoff: CompletedArrivalHandoff,
  modelAccess: VesselTripPredictionModelAccess
): Promise<MlTimelineOverlay> => {
  const finalPredictedTrip = await applyVesselPredictions(
    modelAccess,
    handoff.scheduleTrip
  );

  return {
    vesselAbbrev: handoff.tripToComplete.VesselAbbrev,
    branch: "completed",
    completedHandoffKey: buildCompletedHandoffKey(
      handoff.tripToComplete.VesselAbbrev,
      handoff.tripToComplete,
      handoff.scheduleTrip
    ),
    finalPredictedTrip,
  };
};

/**
 * Canonical predictions entrypoint for orchestrator callers.
 *
 * Derives prediction inputs internally from the upstream trip update and
 * short-circuits with empty output when there is nothing to predict against.
 *
 * @param input - Upstream trip update plus model access context
 * @returns Prediction rows and timeline ML overlays for this ping
 */
export const updateVesselPredictions = async (
  input: RunUpdateVesselPredictionsInput
): Promise<UpdateVesselPredictionsOutput> => {
  const { activeTrip, completedHandoff } = predictionInputsFromTripUpdate(
    input.tripUpdate
  );
  if (completedHandoff === undefined && activeTrip === undefined) {
    return {
      predictionRows: [],
      mlTimelineOverlays: [],
    };
  }

  const modelAccess = predictionModelAccessFromContext(input.predictionContext);
  const completedHandoffs =
    completedHandoff === undefined ? [] : [completedHandoff];
  const activeTrips = activeTrip === undefined ? [] : [activeTrip];

  const mlTimelineOverlays = [
    ...(await Promise.all(
      completedHandoffs.map((handoff) =>
        buildPredictedCompletedHandoff(handoff, modelAccess)
      )
    )),
    ...(await Promise.all(
      activeTrips.map((trip) => buildPredictedCurrentTrip(trip, modelAccess))
    )),
  ];

  const predictionRows = mlTimelineOverlays.flatMap((overlay) =>
    overlay.finalPredictedTrip === undefined
      ? []
      : vesselTripPredictionProposalsFromMlTrip(overlay.finalPredictedTrip)
  );

  return {
    predictionRows,
    mlTimelineOverlays,
  };
};
