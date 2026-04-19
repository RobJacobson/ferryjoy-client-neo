/**
 * Canonical Stage D prediction runner: consumes `tripComputations` plus a
 * plain-data prediction context and emits proposal rows plus predicted trip
 * handoff data.
 */

import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type { ConvexPrediction, ConvexVesselTripWithML } from "functions/vesselTrips/schemas";
import { applyVesselPredictions } from "./applyVesselPredictions";
import type {
  PredictedTripComputation,
  RunUpdateVesselPredictionsInput,
  RunUpdateVesselPredictionsOutput,
  TripPredictionSet,
  VesselPredictionContext,
} from "./contracts";
import { vesselTripPredictionProposalsFromMlTrip } from "./vesselTripPredictionProposalsFromMlTrip";

const noPredictionGates = {
  shouldAttemptAtDockPredictions: false,
  shouldAttemptAtSeaPredictions: false,
  didJustLeaveDock: false,
} as const;

/**
 * Stage C currently emits some active-upsert-only computations without gates.
 * Those rows are not prediction-capable, so Stage D treats them as an explicit
 * no-op compatibility case rather than inventing new prediction behavior.
 */
const predictionGatesForComputation = (
  computation: RunUpdateVesselPredictionsInput["tripComputations"][number]
) => {
  if (computation.tripCore.gates !== undefined) {
    return computation.tripCore.gates;
  }
  if (computation.branch === "current" && computation.events === undefined) {
    return noPredictionGates;
  }
  throw new Error(
    `Missing prediction gates for trip computation ${computation.vesselAbbrev}:${computation.branch}`
  );
};

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
      ReturnType<VesselTripPredictionModelAccess["loadModelsForProductionPairBatch"]>
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
  modelAccess: VesselTripPredictionModelAccess
): Promise<PredictedTripComputation> => {
  const finalPredictedTrip = await applyVesselPredictions(
    modelAccess,
    computation.tripCore.withFinalSchedule,
    predictionGatesForComputation(computation)
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
      buildPredictedTripComputation(computation, modelAccess)
    )
  );

  return {
    vesselTripPredictions: predictedTripComputations.flatMap((computation) =>
      computation.finalPredictedTrip === undefined
        ? []
        : vesselTripPredictionProposalsFromMlTrip(computation.finalPredictedTrip)
    ),
    predictedTripComputations,
  };
};
