/**
 * One-ping prediction pass: ML overlay per active trip and completed handoff,
 * then derive table proposals. Orchestrator uses {@link runVesselPredictionPing};
 * callers that only need upsert DTOs use {@link computeVesselPredictionRows}.
 */

import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type {
  CompletedArrivalHandoff,
  MlTimelineOverlay,
} from "domain/vesselOrchestration/shared";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { applyVesselPredictions } from "./applyVesselPredictions";
import type {
  RunUpdateVesselPredictionsInput,
  RunUpdateVesselPredictionsOutput,
  VesselPredictionContext,
} from "./contracts";
import { vesselTripPredictionProposalsFromMlTrip } from "./vesselTripPredictionProposalsFromMlTrip";

export type RunVesselPredictionPingOutput = RunUpdateVesselPredictionsOutput & {
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
      // Access interface expects `Record<ModelType, ...>` even when callers pass
      // a subset of `ModelType[]`; build only requested keys and narrow once.
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
    activeTrip: trip,
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
    completedTrip: handoff.tripToComplete,
    activeTrip: handoff.scheduleTrip,
    finalPredictedTrip,
  };
};

export const runVesselPredictionPing = async (
  input: RunUpdateVesselPredictionsInput
): Promise<RunVesselPredictionPingOutput> => {
  const modelAccess = predictionModelAccessFromContext(input.predictionContext);
  const mlTimelineOverlays = [
    ...(await Promise.all(
      input.completedHandoffs.map((handoff) =>
        buildPredictedCompletedHandoff(handoff, modelAccess)
      )
    )),
    ...(await Promise.all(
      input.activeTrips.map((trip) =>
        buildPredictedCurrentTrip(trip, modelAccess)
      )
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

export const computeVesselPredictionRows = async (
  input: RunUpdateVesselPredictionsInput
): Promise<RunUpdateVesselPredictionsOutput> => {
  const { predictionRows } = await runVesselPredictionPing(input);
  return { predictionRows };
};
