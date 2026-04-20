/**
 * Canonical Stage D prediction runner: consumes tick trip rows plus a
 * plain-data prediction context and emits proposal rows plus predicted trip
 * handoff data.
 */

import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type { ConvexVesselTripWithML } from "functions/vesselTrips/schemas";
import { applyVesselPredictions } from "./applyVesselPredictions";
import type {
  PredictedTripComputation,
  RunUpdateVesselPredictionsInput,
  RunUpdateVesselPredictionsOutput,
  VesselPredictionContext,
} from "./contracts";
import { vesselTripPredictionProposalsFromMlTrip } from "./vesselTripPredictionProposalsFromMlTrip";

const predictionModelAccessFromContext = (
  context: VesselPredictionContext
): VesselTripPredictionModelAccess => ({
  loadModelForProductionPair: async (pairKey, modelType) =>
    context.productionModelsByPair?.[pairKey]?.[modelType] ?? null,
  loadModelsForProductionPairBatch: async (pairKey, modelTypes) =>
    Object.fromEntries(
      modelTypes.map((modelType) => [
        modelType,
        context.productionModelsByPair?.[pairKey]?.[modelType] ?? null,
      ])
    ) as Awaited<
      ReturnType<
        VesselTripPredictionModelAccess["loadModelsForProductionPairBatch"]
      >
    >,
});

const buildPredictedCurrentTrip = async (
  trip: RunUpdateVesselPredictionsInput["activeTrips"][number],
  modelAccess: VesselTripPredictionModelAccess
): Promise<PredictedTripComputation> => {
  const finalPredictedTrip = await applyVesselPredictions(
    modelAccess,
    trip
  );

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
    handoff.newTripCore.withFinalSchedule
  );

  return {
    vesselAbbrev: handoff.tripToComplete.VesselAbbrev,
    branch: "completed",
    completedTrip: handoff.tripToComplete,
    activeTrip: handoff.newTripCore.withFinalSchedule,
    finalPredictedTrip,
  };
};

export const runUpdateVesselPredictions = async (
  input: RunUpdateVesselPredictionsInput
): Promise<RunUpdateVesselPredictionsOutput> => {
  const modelAccess = predictionModelAccessFromContext(input.predictionContext);
  const predictedTripComputations = [
    ...(await Promise.all(
      input.completedHandoffs.map((handoff) =>
        buildPredictedCompletedHandoff(handoff, modelAccess)
      )
    )),
    ...(await Promise.all(
      input.activeTrips.map((trip) => buildPredictedCurrentTrip(trip, modelAccess))
    )),
  ];

  return {
    vesselTripPredictions: predictedTripComputations.flatMap((computation) =>
      computation.finalPredictedTrip === undefined
        ? []
        : vesselTripPredictionProposalsFromMlTrip(
            computation.finalPredictedTrip
          )
    ),
    predictedTripComputations,
  };
};
