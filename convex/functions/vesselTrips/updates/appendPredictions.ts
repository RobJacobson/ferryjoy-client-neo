// ============================================================================
// Append ML Predictions
// Enriches vessel trips with ML predictions when event-triggered (arrive-dock, depart-dock)
// ============================================================================

import type { ActionCtx } from "_generated/server";
import { loadModelsForPairBatch } from "domain/ml/prediction/predictTrip";
import {
  isPredictionReadyTrip,
  PREDICTION_SPECS,
  type PredictionSpec,
  predictFromSpec,
} from "domain/ml/prediction/vesselTripPredictions";
import { formatTerminalPairKey } from "domain/ml/shared/config";
import type { ModelType } from "domain/ml/shared/types";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

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
 * - Skips specs where predictions already exist (avoid redundant work)
 * - Validates trip readiness via isPredictionReadyTrip
 * - Checks required fields (e.g., LeftDock for certain predictions)
 * - Batches model loading when multiple predictions needed for efficiency
 *
 * @param ctx - Convex action context for running ML predictions
 * @param trip - Current vessel trip state
 * @param specs - Prediction specs to attempt (e.g., at-dock or leave-dock)
 * @returns Trip with prediction fields applied
 */
const computePredictions = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip,
  specs: PredictionSpec[]
): Promise<ConvexVesselTrip> => {
  // Skip if prediction already set for any spec
  const specsToAttempt = specs.filter((spec) => trip[spec.field] === undefined);
  if (specsToAttempt.length === 0) return trip;

  // Validate trip readiness
  if (!isPredictionReadyTrip(trip)) return trip;

  // Validate LeftDock requirements
  for (const spec of specsToAttempt) {
    if (spec.requiresLeftDock && !trip.LeftDock) {
      return trip;
    }
  }

  // Batch load models when multiple predictions needed
  let modelsMap: Record<ModelType, ModelDoc | null> = {} as Record<
    ModelType,
    ModelDoc | null
  >;
  if (
    specsToAttempt.length > 1 &&
    trip.ArrivingTerminalAbbrev &&
    trip.DepartingTerminalAbbrev
  ) {
    const pairKey = formatTerminalPairKey(
      trip.DepartingTerminalAbbrev,
      trip.ArrivingTerminalAbbrev
    );
    const modelTypes = specsToAttempt.map((s) => s.modelType);
    modelsMap = await loadModelsForPairBatch(ctx, pairKey, modelTypes);
  }

  // Run predictions
  const results = await Promise.all(
    specsToAttempt.map(async (spec) => ({
      spec,
      prediction: await predictFromSpec(
        ctx,
        trip,
        spec,
        specsToAttempt.length > 1 ? modelsMap[spec.modelType] : undefined
      ),
    }))
  );

  // Aggregate results
  const updates = results.reduce<Record<string, unknown>>(
    (acc, { spec, prediction }) => {
      if (prediction) {
        acc[spec.field] = prediction;
      }
      return acc;
    },
    {}
  );

  return { ...trip, ...updates } as ConvexVesselTrip;
};

/**
 * Enrich trip with at-dock predictions when vessel first arrives at dock.
 *
 * Predicts AtDockArriveNext and AtDockDepartNext when vessel transitions
 * from at-sea to at-dock and trip has required context (isPredictionReadyTrip).
 *
 * @param ctx - Convex action context for running ML predictions
 * @param trip - Current vessel trip state
 * @returns Trip enriched with at-dock prediction fields
 */
export const appendArriveDockPredictions = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip
): Promise<ConvexVesselTrip> => {
  return computePredictions(ctx, trip, [
    PREDICTION_SPECS.AtDockArriveNext,
    PREDICTION_SPECS.AtDockDepartNext,
  ]);
};

/**
 * Enrich trip with leave-dock predictions when vessel physically departs.
 *
 * Predicts AtDockDepartCurr, AtSeaArriveNext, and AtSeaDepartNext when
 * LeftDock transitions from undefined to defined (vessel leaves dock).
 *
 * @param ctx - Convex action context for running ML predictions
 * @param trip - Current vessel trip state
 * @returns Trip enriched with leave-dock prediction fields
 */
export const appendLeaveDockPredictions = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip
): Promise<ConvexVesselTrip> => {
  return computePredictions(ctx, trip, [
    PREDICTION_SPECS.AtDockDepartCurr,
    PREDICTION_SPECS.AtSeaArriveNext,
    PREDICTION_SPECS.AtSeaDepartNext,
  ]);
};
