// ============================================================================
// LEFT DOCK PREDICTION (arrive-depart-delay model)
// ============================================================================

import type { ActionCtx, MutationCtx } from "_generated/server";
import { MODEL_TYPES } from "../../shared/core/modelTypes";
import { featureExtractors, makePrediction } from "./shared";
import type { DelayPredictionParams, PredictionResult } from "./types";

/**
 * Predict departure delay for a new trip using the arrive-depart-delay model
 *
 * This function predicts how many minutes early or late a vessel will depart
 * relative to its scheduled departure time. Used when a vessel arrives at dock
 * and a new trip is about to start.
 *
 * @param ctx - Convex action or mutation context for database access
 * @param params - Parameters required for delay prediction including trip context
 * @returns Prediction result with delay in minutes and model accuracy (MAE)
 */
export const predictDelayOnArrival = async (
  ctx: ActionCtx | MutationCtx,
  params: DelayPredictionParams
): Promise<PredictionResult> => {
  const features = featureExtractors.arrivalBased({
    departingTerminal: params.departingTerminal,
    arrivingTerminal: params.arrivingTerminal || "",
    scheduledDeparture: params.scheduledDeparture,
    prevDelay: params.previousDelay,
    prevAtSeaDuration: params.previousAtSeaDuration,
    tripStart: params.tripStart,
  });

  // For delay prediction, we return the raw delay minutes (not a timestamp)
  const result = await makePrediction(
    ctx,
    MODEL_TYPES.ARRIVE_DEPART_DELAY,
    params.departingTerminal,
    params.arrivingTerminal || "",
    features,
    (delay) => ({ absoluteTime: delay, referenceTime: 0, minimumGap: 0 }) // Delay is not a timestamp
  );

  // Return delay as predictedTime (not a timestamp)
  return {
    predictedTime: result.predictedTime, // This is delay in minutes
    mae: result.mae,
  };
};
