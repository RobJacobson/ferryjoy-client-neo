/**
 * Canonical Stage D prediction runner: consumes `tripComputations` plus a
 * plain-data prediction context and emits proposal rows plus predicted trip
 * handoff data.
 */

import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type {
  ConvexPrediction,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import { applyVesselPredictions } from "./applyVesselPredictions";
import type {
  PredictedTripComputation,
  RunUpdateVesselPredictionsInput,
  RunUpdateVesselPredictionsOutput,
  TripPredictionSet,
  VesselPredictionContext,
} from "./contracts";
import { derivePredictionGatesForComputation } from "./predictionPolicy";
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

const isFullPrediction = (
  value: ConvexVesselTripWithML[keyof TripPredictionSet]
): value is ConvexPrediction =>
  value !== undefined &&
  "MinTime" in value &&
  "MaxTime" in value &&
  "MAE" in value &&
  "StdDev" in value;

const tripPredictionSetFromTrip = (
  trip: ConvexVesselTripWithML
): TripPredictionSet => {
  const predictions: TripPredictionSet = {};

  if (isFullPrediction(trip.AtDockDepartCurr)) {
    predictions.AtDockDepartCurr = trip.AtDockDepartCurr;
  }
  if (isFullPrediction(trip.AtDockArriveNext)) {
    predictions.AtDockArriveNext = trip.AtDockArriveNext;
  }
  if (isFullPrediction(trip.AtDockDepartNext)) {
    predictions.AtDockDepartNext = trip.AtDockDepartNext;
  }
  if (isFullPrediction(trip.AtSeaArriveNext)) {
    predictions.AtSeaArriveNext = trip.AtSeaArriveNext;
  }
  if (isFullPrediction(trip.AtSeaDepartNext)) {
    predictions.AtSeaDepartNext = trip.AtSeaDepartNext;
  }

  return predictions;
};

const buildPredictedTripComputation = async (
  computation: RunUpdateVesselPredictionsInput["tripComputations"][number],
  modelAccess: VesselTripPredictionModelAccess,
  tickStartedAt: number
): Promise<PredictedTripComputation> => {
  const finalPredictedTrip = await applyVesselPredictions(
    modelAccess,
    computation.tripCore.withFinalSchedule,
    derivePredictionGatesForComputation(computation, tickStartedAt)
  );

  return {
    ...computation,
    predictions: tripPredictionSetFromTrip(finalPredictedTrip),
    finalPredictedTrip,
  };
};

export const runUpdateVesselPredictions = async (
  input: RunUpdateVesselPredictionsInput
): Promise<RunUpdateVesselPredictionsOutput> => {
  const modelAccess = predictionModelAccessFromContext(input.predictionContext);
  const predictedTripComputations = await Promise.all(
    input.tripComputations.map((computation) =>
      buildPredictedTripComputation(
        computation,
        modelAccess,
        input.tickStartedAt
      )
    )
  );

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
