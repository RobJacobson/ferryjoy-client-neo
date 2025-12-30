// ============================================================================
// PREDICTION RESULT PROCESSING UTILITIES
// Shared functions for processing ML prediction results
// ============================================================================

import { roundToPrecision } from "./durationUtils";

/**
 * Processes raw result from a delay prediction and formats it for storage.
 *
 * Note: This function is deprecated. Predictions are now generated directly
 * by predictor functions using VesselTrip objects. Kept for reference.
 *
 * @param predictedTime - The raw predicted delay time in minutes, or undefined if prediction failed
 * @param mae - The mean absolute error of prediction model
 * @returns Formatted prediction results with DelayPred and DelayPredMae, or undefined if prediction failed
 * @deprecated Prediction results are now generated directly in predictor functions
 */
export const processPredictionResult = (
  predictedTime: number | undefined,
  mae: number | undefined
): { DelayPred: number; DelayPredMae: number } | undefined => {
  if (predictedTime === undefined) {
    return undefined;
  }

  return {
    DelayPred: roundToPrecision(predictedTime, 10), // Delay in minutes
    DelayPredMae: roundToPrecision(mae ?? 0, 100),
  };
};
