// ============================================================================
// PREDICTION RESULT PROCESSING UTILITIES
// Shared functions for processing ML prediction results
// ============================================================================

import type { DelayPredictionParams } from "../domain/ml/prediction/predictors/types";
import { epochMsToDate } from "./convertDates";
import { roundToPrecision } from "./durationUtils";

/**
 * Processes the raw result from a delay prediction and formats it for storage.
 *
 * @param predictedTime - The raw predicted delay time in minutes, or undefined if prediction failed
 * @param mae - The mean absolute error of the prediction model
 * @param vesselAbbrev - The vessel abbreviation for logging
 * @param predictionParams - The parameters used for the prediction (for logging)
 * @returns Formatted prediction results with DelayPred and DelayPredMae, or undefined if prediction failed
 */
export const processPredictionResult = (
  predictedTime: number | undefined,
  mae: number | undefined,
  vesselAbbrev: string,
  predictionParams: DelayPredictionParams
): { DelayPred: number; DelayPredMae: number } | undefined => {
  if (predictedTime === undefined) {
    console.error(
      `[Prediction] DelayPred failed for ${vesselAbbrev}: Unexpected undefined prediction`
    );
    return undefined;
  }

  console.log(
    `[Prediction] DelayPred calculated for ${vesselAbbrev} (denormalized):`,
    {
      vessel: vesselAbbrev,
      departingTerminal: predictionParams.departingTerminal,
      arrivingTerminal: predictionParams.arrivingTerminal,
      previousTripDelay: predictionParams.previousDelay,
      previousTripAtSeaDuration: predictionParams.previousAtSeaDuration,
      currentTripStart: epochMsToDate(predictionParams.tripStart),
      scheduledDeparture: epochMsToDate(predictionParams.scheduledDeparture),
      predictedDelay: predictedTime, // Delay in minutes
      delayMae: mae,
    }
  );

  return {
    DelayPred: roundToPrecision(predictedTime, 10), // Delay in minutes
    DelayPredMae: roundToPrecision(mae ?? 0, 100),
  };
};
