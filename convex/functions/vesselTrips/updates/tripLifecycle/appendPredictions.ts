/**
 * Prediction enrichment helpers for vessel-trip updates.
 *
 * Adds the ML predictions that are valid for the trip's current phase and
 * supports both event-driven runs and the once-per-minute fallback window.
 */

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
 * - Skips specs where predictions already exist (avoid redundant work)
 * - Validates trip readiness via isPredictionReadyTrip
 * - Checks required fields (e.g., canonical departure actual for at-sea predictions)
 * - Batches model loading when multiple predictions needed for efficiency
 *
 * @param ctx - Convex action context for running ML predictions
 * @param trip - Current vessel trip state
 * @param specs - Prediction specs to attempt (e.g., at-dock or leave-dock)
 * @returns Trip with prediction fields applied
 */
const computePredictions = async (
  ctx: ActionCtx,
  trip: ConvexVesselTripWithML,
  specs: PredictionSpec[]
): Promise<ConvexVesselTripWithML> => {
  try {
    const specsToAttempt = specs.filter(
      (spec) => trip[spec.field] === undefined
    );

    if (specsToAttempt.length === 0) return trip;

    if (!isPredictionReadyTrip(trip)) return trip;

    const departureMs = trip.DepartOriginActual;

    if (
      specsToAttempt.some(
        (spec) => spec.requiresDepartureActual && !departureMs
      )
    ) {
      return trip;
    }

    // When multiple specs share the same terminal pair, load models once.
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
      modelsMap =
        (await loadModelsForPairBatch(ctx, pairKey, modelTypes)) ??
        ({} as Record<ModelType, ModelDoc | null>);
    }

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
 * (isPredictionReadyTrip).
 * Runs on event-driven (arrive at dock) and time-based fallback (once per minute).
 *
 * @param ctx - Convex action context for running ML predictions
 * @param trip - Current vessel trip state
 * @returns Trip enriched with at-dock prediction fields
 */
export const appendArriveDockPredictions = async (
  ctx: ActionCtx,
  trip: ConvexVesselTripWithML
): Promise<ConvexVesselTripWithML> => {
  return computePredictions(ctx, trip, [
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
 * (isPredictionReadyTrip).
 * Runs on event-driven (leave dock) and time-based fallback (once per minute).
 *
 * @param ctx - Convex action context for running ML predictions
 * @param trip - Current vessel trip state
 * @returns Trip enriched with at-sea prediction fields
 */
export const appendLeaveDockPredictions = async (
  ctx: ActionCtx,
  trip: ConvexVesselTripWithML
): Promise<ConvexVesselTripWithML> => {
  return computePredictions(ctx, trip, [
    PREDICTION_SPECS.AtSeaArriveNext,
    PREDICTION_SPECS.AtSeaDepartNext,
  ]);
};
