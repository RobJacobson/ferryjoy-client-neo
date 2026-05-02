/**
 * Prediction enrichment helpers for vessel-trip updates.
 *
 * Adds the ML predictions that are valid for the trip's current phase.
 * Predictions re-run whenever the orchestrator applies an update for the active
 * phase, and persistence dedupes
 * unchanged proposal rows.
 */

import type { ProductionModelParameters } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import {
  isPredictionReadyTrip,
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

/**
 * Returns whether the trip satisfies readiness and per-spec inputs for the
 * given prediction specs.
 *
 * @param trip - Current vessel trip row (may already carry prediction fields)
 * @param specs - Prediction specs to evaluate prerequisites for
 * @returns True when every required gate passes for these specs
 */
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

/**
 * Maps already-loaded prediction model parameter docs by model type for the trip's
 * terminal pair.
 *
 * @param predictionModelParametersByPairKey - Lookup from pair key to model-type docs
 * @param trip - Trip whose departing/arriving abbrevs define the pair key
 * @param specs - Spec list whose model types are pulled from the lookup
 * @returns Partial record of model type to parameters for `predictFromSpec`
 */
const loadedModelsForSpecs = (
  predictionModelParametersByPairKey:
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
      predictionModelParametersByPairKey?.[pairKey]?.[spec.modelType] ?? null,
    ])
  ) as Partial<Record<ModelType, ModelDoc | null>>;
};

/**
 * Runs inference for each spec using preloaded parameter docs for this pair.
 *
 * @param trip - Current vessel trip state
 * @param specs - Specs to run in parallel
 * @param preloadedModelsByType - Model parameters keyed by model type for this
 *   pair (used when `specs.length > 1` to batch cache hits)
 * @returns One result per spec in input order
 */
const runPredictionsForSpecs = async (
  trip: ConvexVesselTripWithML,
  specs: ReadonlyArray<PredictionSpec>,
  preloadedModelsByType: Partial<Record<ModelType, ModelDoc | null>>
): Promise<ReadonlyArray<SpecPredictionResult>> =>
  Promise.all(
    specs.map(async (spec) => ({
      spec,
      prediction: await predictFromSpec(
        null,
        trip,
        spec,
        specs.length > 1 ? preloadedModelsByType[spec.modelType] : undefined
      ),
    }))
  );

/**
 * Merges non-null prediction outputs onto the trip row by prediction field
 * name.
 *
 * @param trip - Trip before applying this batch of outputs
 * @param results - Spec plus nullable prediction from `predictFromSpec`
 * @returns Trip shallow-merged with any non-null prediction fields
 */
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
 * Applies predictions from prediction model parameters already loaded for this
 * terminal pair (orchestrator path).
 *
 * @param predictionModelParametersByPairKey - Keyed by pair string from
 *   **`getPredictionModelParameters`**
 * @param trip - Current vessel trip state
 * @param specs - Specs from **`getPredictionSpecsFromTrip`** for this dock vs sea state
 * @returns Trip with prediction fields applied
 */
export const appendPredictionsFromLoadedModels = async (
  predictionModelParametersByPairKey:
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
      predictionModelParametersByPairKey,
      trip,
      specs
    );
    const results = await runPredictionsForSpecs(
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
