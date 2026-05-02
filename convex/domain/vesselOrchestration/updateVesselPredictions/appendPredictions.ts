/**
 * Prediction enrichment helpers for vessel-trip updates.
 *
 * Adds the ML predictions that are valid for the trip's current phase.
 * Predictions re-run on every ping for the active phase, and persistence dedupes
 * unchanged proposal rows.
 */

import { loadModelsForPairBatch } from "domain/ml/prediction/predictTrip";
import type {
  ProductionModelParameters,
  VesselTripPredictionModelAccess,
} from "domain/ml/prediction/vesselTripPredictionModelAccess";
import {
  isPredictionReadyTrip,
  PREDICTION_SPECS,
  type PredictionSpec,
  predictFromSpec,
} from "domain/ml/prediction/vesselTripPredictions";
import { formatTerminalPairKey } from "domain/ml/shared/config";
import type { ModelType } from "domain/ml/shared/types";
import type { ConvexVesselTripWithML } from "functions/vesselTrips/schemas";

type ModelDoc = ProductionModelParameters;

type SpecPredictionResult = {
  spec: PredictionSpec;
  prediction: Awaited<ReturnType<typeof predictFromSpec>>;
};

const hasRequiredInputsForSpecs = (
  trip: ConvexVesselTripWithML,
  specs: ReadonlyArray<PredictionSpec>
): boolean => {
  if (!isPredictionReadyTrip(trip)) {
    return false;
  }

  if (
    specs.some(
      (spec) => spec.requiresDepartureActual && trip.LeftDockActual == null
    )
  ) {
    return false;
  }

  return true;
};

const preloadModelsForSpecs = async (
  modelAccess: VesselTripPredictionModelAccess,
  trip: ConvexVesselTripWithML,
  specs: ReadonlyArray<PredictionSpec>
): Promise<Partial<Record<ModelType, ModelDoc | null>>> => {
  if (
    specs.length <= 1 ||
    trip.ArrivingTerminalAbbrev === undefined ||
    trip.DepartingTerminalAbbrev === undefined
  ) {
    return {};
  }

  const pairKey = formatTerminalPairKey(
    trip.DepartingTerminalAbbrev,
    trip.ArrivingTerminalAbbrev
  );
  const modelTypes = specs.map((spec) => spec.modelType);
  return (await loadModelsForPairBatch(modelAccess, pairKey, modelTypes)) ?? {};
};

const loadedModelsForSpecs = (
  productionModelsByPair:
    | Readonly<Record<string, Partial<Record<ModelType, ModelDoc | null>>>>
    | undefined,
  trip: ConvexVesselTripWithML,
  specs: ReadonlyArray<PredictionSpec>
): Partial<Record<ModelType, ModelDoc | null>> => {
  if (
    trip.ArrivingTerminalAbbrev === undefined ||
    trip.DepartingTerminalAbbrev === undefined
  ) {
    return {};
  }

  const pairKey = formatTerminalPairKey(
    trip.DepartingTerminalAbbrev,
    trip.ArrivingTerminalAbbrev
  );
  return Object.fromEntries(
    specs.map((spec) => [
      spec.modelType,
      productionModelsByPair?.[pairKey]?.[spec.modelType] ?? null,
    ])
  ) as Partial<Record<ModelType, ModelDoc | null>>;
};

const runPredictionsForSpecs = async (
  modelAccess: VesselTripPredictionModelAccess | null,
  trip: ConvexVesselTripWithML,
  specs: ReadonlyArray<PredictionSpec>,
  preloadedModelsByType: Partial<Record<ModelType, ModelDoc | null>>
): Promise<ReadonlyArray<SpecPredictionResult>> =>
  Promise.all(
    specs.map(async (spec) => ({
      spec,
      prediction: await predictFromSpec(
        modelAccess,
        trip,
        spec,
        specs.length > 1 ? preloadedModelsByType[spec.modelType] : undefined
      ),
    }))
  );

const applySpecPredictionResults = (
  trip: ConvexVesselTripWithML,
  results: ReadonlyArray<SpecPredictionResult>
): ConvexVesselTripWithML => {
  const predictionUpdates = results.reduce<Partial<ConvexVesselTripWithML>>(
    (updates, { spec, prediction }) => {
      if (prediction != null) {
        updates[spec.field] = prediction;
      }
      return updates;
    },
    {}
  );

  if (Object.keys(predictionUpdates).length === 0) {
    return trip;
  }

  return { ...trip, ...predictionUpdates };
};

/**
 * Compute predictions for a specific set of prediction specs.
 *
 * Core prediction logic that:
 * - Re-runs every phase-valid spec on each ping
 * - Validates trip readiness via isPredictionReadyTrip
 * - Checks required fields (e.g., canonical departure actual for at-sea predictions)
 * - Batches model loading when multiple predictions needed for efficiency
 *
 * @param modelAccess - Production model parameters (orchestrator `runQuery`)
 * @param trip - Current vessel trip state
 * @param specs - Prediction specs to attempt (e.g., at-dock or at-sea)
 * @returns Trip with prediction fields applied
 */
const computePredictions = async (
  modelAccess: VesselTripPredictionModelAccess,
  trip: ConvexVesselTripWithML,
  specs: ReadonlyArray<PredictionSpec>
): Promise<ConvexVesselTripWithML> => {
  try {
    if (!hasRequiredInputsForSpecs(trip, specs)) {
      return trip;
    }

    const preloadedModelsByType = await preloadModelsForSpecs(
      modelAccess,
      trip,
      specs
    );
    const results = await runPredictionsForSpecs(
      modelAccess,
      trip,
      specs,
      preloadedModelsByType
    );

    return applySpecPredictionResults(trip, results);
  } catch (error) {
    console.error(
      `[Prediction] Failed to compute predictions for ${trip.VesselAbbrev}:`,
      error
    );
    return trip;
  }
};

export const appendPredictionsFromLoadedModels = async (
  productionModelsByPair:
    | Readonly<Record<string, Partial<Record<ModelType, ModelDoc | null>>>>
    | undefined,
  trip: ConvexVesselTripWithML,
  specs: ReadonlyArray<PredictionSpec>
): Promise<ConvexVesselTripWithML> => {
  try {
    if (!hasRequiredInputsForSpecs(trip, specs)) {
      return trip;
    }

    const preloadedModelsByType = loadedModelsForSpecs(
      productionModelsByPair,
      trip,
      specs
    );
    const results = await runPredictionsForSpecs(
      null,
      trip,
      specs,
      preloadedModelsByType
    );

    return applySpecPredictionResults(trip, results);
  } catch (error) {
    console.error(
      `[Prediction] Failed to compute predictions for ${trip.VesselAbbrev}:`,
      error
    );
    return trip;
  }
};

/**
 * Enrich trip with at-dock predictions when vessel is at dock.
 *
 * Predicts AtDockDepartCurr, AtDockArriveNext, and AtDockDepartNext when
 * vessel is at dock and trip has required canonical origin-arrival context
 * (isPredictionReadyTrip). The orchestrator re-runs these predictions on every
 * ping while the trip stays in the at-dock phase.
 *
 * @param modelAccess - Production model parameters (orchestrator `runQuery`)
 * @param trip - Current vessel trip state
 * @returns Trip enriched with at-dock prediction fields
 */
export const appendAtDockPredictions = async (
  modelAccess: VesselTripPredictionModelAccess,
  trip: ConvexVesselTripWithML
): Promise<ConvexVesselTripWithML> => {
  return computePredictions(modelAccess, trip, [
    ...PREDICTION_SPECS["at-dock"],
  ]);
};

/**
 * Enrich trip with at-sea predictions when vessel is at sea.
 *
 * Predicts AtSeaArriveNext and AtSeaDepartNext when vessel is underway
 * (has canonical departure state) and trip has required context
 * (isPredictionReadyTrip). The orchestrator re-runs these predictions on every
 * ping while the trip stays in the at-sea phase.
 *
 * @param modelAccess - Production model parameters (orchestrator `runQuery`)
 * @param trip - Current vessel trip state
 * @returns Trip enriched with at-sea prediction fields
 */
export const appendAtSeaPredictions = async (
  modelAccess: VesselTripPredictionModelAccess,
  trip: ConvexVesselTripWithML
): Promise<ConvexVesselTripWithML> => {
  return computePredictions(modelAccess, trip, [...PREDICTION_SPECS["at-sea"]]);
};
