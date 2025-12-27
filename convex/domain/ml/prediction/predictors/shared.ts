// ============================================================================
// SHARED PREDICTION LOGIC
// ============================================================================

import type { ActionCtx, MutationCtx } from "_generated/server";
import { loadModel } from "../step_2_loadModel";
import {
  applyLinearRegression,
  validatePredictionTime,
} from "../step_3_makePrediction";
import type {
  PredictionConfig,
  PredictionResult,
  TerminalContext,
} from "./types";

/**
 * Generic prediction orchestrator
 * Reduces code duplication across all predictors
 * Only returns successful predictions, throws errors for all failure cases.
 */
export const predict = async <TContext extends TerminalContext>(
  ctx: ActionCtx | MutationCtx,
  config: PredictionConfig<TContext>,
  predictionContext: TContext
): Promise<PredictionResult> => {
  // Step 1: Validate sufficient data
  if (config.skipPrediction(predictionContext)) {
    console.error(`[Prediction] Prediction failed: Insufficient context data`);
    throw new Error(`Prediction failed: Insufficient context data`);
  }

  // Step 2: Extract features
  const { features, error } = config.extractFeatures(predictionContext);
  if (error) {
    console.error(`[Prediction] Feature extraction failed: ${error}`);
    throw new Error(`Prediction failed: Feature extraction failed: ${error}`);
  }

  // Step 3: Load model
  const model = await loadModel(
    ctx,
    predictionContext.departingTerminal,
    predictionContext.arrivingTerminal,
    config.modelName
  );

  if (!model) {
    console.error(
      `[Prediction] Prediction failed: Model not found for ${config.modelName}`
    );
    throw new Error(
      `Prediction failed: Model not found for ${config.modelName}`
    );
  }

  // Step 4: Make prediction
  const predictedDuration = applyLinearRegression(model, features);

  // Step 5: Convert to absolute time
  const { absoluteTime, referenceTime, minimumGap } = config.convertToAbsolute(
    predictedDuration,
    predictionContext
  );

  // Step 6: Validate and clamp
  const validatedTime = validatePredictionTime(
    absoluteTime,
    referenceTime,
    minimumGap
  );

  return {
    predictedTime: validatedTime,
    mae: model.trainingMetrics.mae,
  };
};
