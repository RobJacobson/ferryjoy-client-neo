/**
 * Prediction enrichment helpers for vessel-trip updates.
 *
 * Adds the ML predictions that are valid for the trip's current phase.
 * Predictions re-run on every tick for the active phase, and persistence dedupes
 * unchanged proposal rows.
 */

import { loadModelsForPairBatch } from "domain/ml/prediction/predictTrip";
import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import {
  isPredictionReadyTrip,
  PREDICTION_SPECS,
  type PredictionSpec,
  predictFromSpec,
} from "domain/ml/prediction/vesselTripPredictions";
import { formatTerminalPairKey } from "domain/ml/shared/config";
import type { ModelType } from "domain/ml/shared/types";
import type { ConvexVesselTripWithML } from "functions/vesselTrips/schemas";

type ModelDoc = {
  featureKeys: string[];
  coefficients: number[];
  intercept: number;
  testMetrics: { mae: number; stdDev: number };
};

/**
 * Compute predictions for a specific set of prediction specs.
 *
 * Core prediction logic that:
 * - Re-runs every phase-valid spec on each tick
 * - Validates trip readiness via isPredictionReadyTrip
 * - Checks required fields (e.g., canonical departure actual for at-sea predictions)
 * - Batches model loading when multiple predictions needed for efficiency
 *
 * @param modelAccess - Production model parameters (orchestrator `runQuery`)
 * @param trip - Current vessel trip state
 * @param specs - Prediction specs to attempt (e.g., at-dock or leave-dock)
 * @returns Trip with prediction fields applied
 */
const computePredictions = async (
  modelAccess: VesselTripPredictionModelAccess,
  trip: ConvexVesselTripWithML,
  specs: PredictionSpec[]
): Promise<ConvexVesselTripWithML> => {
  try {
    if (!isPredictionReadyTrip(trip)) return trip;

    const departureMs = trip.LeftDockActual;

    if (specs.some((spec) => spec.requiresDepartureActual && !departureMs)) {
      return trip;
    }

    // When multiple specs share the same terminal pair, load models once.
    let modelsMap: Record<ModelType, ModelDoc | null> = {} as Record<
      ModelType,
      ModelDoc | null
    >;
    if (
      specs.length > 1 &&
      trip.ArrivingTerminalAbbrev &&
      trip.DepartingTerminalAbbrev
    ) {
      const pairKey = formatTerminalPairKey(
        trip.DepartingTerminalAbbrev,
        trip.ArrivingTerminalAbbrev
      );
      const modelTypes = specs.map((s) => s.modelType);
      modelsMap =
        (await loadModelsForPairBatch(modelAccess, pairKey, modelTypes)) ??
        ({} as Record<ModelType, ModelDoc | null>);
    }

    const results = await Promise.all(
      specs.map(async (spec) => ({
        spec,
        prediction: await predictFromSpec(
          modelAccess,
          trip,
          spec,
          specs.length > 1 ? modelsMap[spec.modelType] : undefined
        ),
      }))
    );

    const updates = results.reduce<Record<string, unknown>>(
      (acc, { spec, prediction }) => {
        if (prediction) {
          acc[spec.field] = prediction;
        }
        return acc;
      },
      {}
    );

    return { ...trip, ...updates } as ConvexVesselTripWithML;
  } catch (error) {
    console.error(
      `[Prediction] Failed to compute predictions for ${trip.VesselAbbrev}:`,
      error
    );
    return { ...trip };
  }
};

/**
 * Enrich trip with at-dock predictions when vessel is at dock.
 *
 * Predicts AtDockDepartCurr, AtDockArriveNext, and AtDockDepartNext when
 * vessel is at dock and trip has required canonical origin-arrival context
 * (isPredictionReadyTrip). The orchestrator re-runs these predictions on every
 * tick while the trip stays in the at-dock phase.
 *
 * @param modelAccess - Production model parameters (orchestrator `runQuery`)
 * @param trip - Current vessel trip state
 * @returns Trip enriched with at-dock prediction fields
 */
export const appendArriveDockPredictions = async (
  modelAccess: VesselTripPredictionModelAccess,
  trip: ConvexVesselTripWithML
): Promise<ConvexVesselTripWithML> => {
  return computePredictions(modelAccess, trip, [
    PREDICTION_SPECS.AtDockDepartCurr,
    PREDICTION_SPECS.AtDockArriveNext,
    PREDICTION_SPECS.AtDockDepartNext,
  ]);
};

/**
 * Enrich trip with at-sea predictions when vessel is at sea.
 *
 * Predicts AtSeaArriveNext and AtSeaDepartNext when vessel is underway
 * (has canonical departure state) and trip has required context
 * (isPredictionReadyTrip). The orchestrator re-runs these predictions on every
 * tick while the trip stays in the at-sea phase.
 *
 * @param modelAccess - Production model parameters (orchestrator `runQuery`)
 * @param trip - Current vessel trip state
 * @returns Trip enriched with at-sea prediction fields
 */
export const appendLeaveDockPredictions = async (
  modelAccess: VesselTripPredictionModelAccess,
  trip: ConvexVesselTripWithML
): Promise<ConvexVesselTripWithML> => {
  return computePredictions(modelAccess, trip, [
    PREDICTION_SPECS.AtSeaArriveNext,
    PREDICTION_SPECS.AtSeaDepartNext,
  ]);
};
