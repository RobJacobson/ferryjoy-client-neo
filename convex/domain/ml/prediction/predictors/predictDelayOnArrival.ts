// ============================================================================
// LEFT DOCK PREDICTION (arrive-depart-delay model)
// ============================================================================

import type { ActionCtx, MutationCtx } from "_generated/server";
import { formatTerminalPairKey } from "../../training/shared/config";
import type { FeatureRecord } from "../step_1_extractFeatures";
import { extractArriveDepartFeatures } from "../step_1_extractFeatures";
import { loadModel } from "../step_2_loadModel";
import { applyLinearRegression } from "../step_3_makePrediction";
import type { DelayPredictionParams, PredictionResult } from "./types";

/**
 * Predict DelayPred when a new trip starts
 * Uses arrive-depart-delay model to predict departure delay in minutes
 * Returns raw delay (not absolute timestamp)
 */
export const predictDelayOnArrival = async (
  ctx: ActionCtx | MutationCtx,
  params: DelayPredictionParams
): Promise<PredictionResult> => {
  // Validation is now handled upstream in validatePredictionData

  // Extract features
  const terminalPairKey = formatTerminalPairKey(
    params.departingTerminal,
    params.arrivingTerminal || ""
  );

  let features: FeatureRecord;
  try {
    features = extractArriveDepartFeatures(
      params.scheduledDeparture,
      params.previousDelay,
      params.previousAtSeaDuration,
      params.tripStart,
      terminalPairKey
    );
  } catch (error) {
    console.error(
      `[Prediction] Feature extraction failed for ${params.vesselAbbrev}: ${error}`
    );
    throw new Error(`Prediction failed: Feature extraction failed: ${error}`);
  }

  // Load model
  const model = await loadModel(
    ctx,
    params.departingTerminal,
    params.arrivingTerminal || "",
    "arrive-depart-delay"
  );

  if (!model) {
    console.error(
      `[Prediction] DelayPred failed for ${params.vesselAbbrev}: Model not found`
    );
    throw new Error(
      `Prediction failed: Model not found for arrive-depart-delay`
    );
  }

  // Make prediction (returns delay in minutes)
  const predictedDelayMinutes = applyLinearRegression(model, features);

  return {
    predictedTime: predictedDelayMinutes, // Delay in minutes (not a timestamp)
    mae: model.trainingMetrics.mae,
  };
};
