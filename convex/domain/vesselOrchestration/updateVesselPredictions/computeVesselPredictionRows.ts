/**
 * One-tick prediction pass: ML overlay per active trip and completed handoff,
 * then derive table proposals. Orchestrator uses {@link runVesselPredictionTick};
 * callers that only need upsert DTOs use {@link computeVesselPredictionRows}.
 */

import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type { PredictedTripComputation } from "domain/vesselOrchestration/shared";
import { applyVesselPredictions } from "./applyVesselPredictions";
import type {
  RunUpdateVesselPredictionsInput,
  RunUpdateVesselPredictionsOutput,
  VesselPredictionContext,
} from "./contracts";
import { vesselTripPredictionProposalsFromMlTrip } from "./vesselTripPredictionProposalsFromMlTrip";

export type RunVesselPredictionTickOutput = RunUpdateVesselPredictionsOutput & {
  predictedTripComputations: ReadonlyArray<PredictedTripComputation>;
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
      (Object.fromEntries(
        modelTypes.map((modelType) => [
          modelType,
          context.productionModelsByPair?.[pairKey]?.[modelType] ?? null,
        ])
      ) as Awaited<
        ReturnType<
          VesselTripPredictionModelAccess["loadModelsForProductionPairBatch"]
        >
      >);

  return {
    loadModelForProductionPair,
    loadModelsForProductionPairBatch,
  };
};

const buildPredictedCurrentTrip = async (
  trip: RunUpdateVesselPredictionsInput["activeTrips"][number],
  modelAccess: VesselTripPredictionModelAccess
): Promise<PredictedTripComputation> => {
  const finalPredictedTrip = await applyVesselPredictions(modelAccess, trip);

  return {
    vesselAbbrev: trip.VesselAbbrev,
    branch: "current",
    activeTrip: trip,
    finalPredictedTrip,
  };
};

const buildPredictedCompletedHandoff = async (
  handoff: RunUpdateVesselPredictionsInput["completedHandoffs"][number],
  modelAccess: VesselTripPredictionModelAccess
): Promise<PredictedTripComputation> => {
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

export const runVesselPredictionTick = async (
  input: RunUpdateVesselPredictionsInput
): Promise<RunVesselPredictionTickOutput> => {
  const modelAccess = predictionModelAccessFromContext(input.predictionContext);
  const predictedTripComputations = [
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

  const predictionRows = predictedTripComputations.flatMap((computation) =>
    computation.finalPredictedTrip === undefined
      ? []
      : vesselTripPredictionProposalsFromMlTrip(computation.finalPredictedTrip)
  );

  return {
    predictionRows,
    predictedTripComputations,
  };
};

export const computeVesselPredictionRows = async (
  input: RunUpdateVesselPredictionsInput
): Promise<RunUpdateVesselPredictionsOutput> => {
  const { predictionRows } = await runVesselPredictionTick(input);
  return { predictionRows };
};

/** @deprecated Use {@link computeVesselPredictionRows}. */
export const runUpdateVesselPredictions = computeVesselPredictionRows;
