import { api } from "@convex/_generated/api";
import type { ActionCtx } from "@convex/_generated/server";

import { log } from "@/shared/lib/logger";

import type { FeatureVector, PredictionOutput } from "./types";

/**
 * Makes a prediction using the trained model
 */
export const predict = async (
  ctx: ActionCtx,
  features: FeatureVector,
  routeId: string
): Promise<PredictionOutput> => {
  // Load model for the route
  const model = await ctx.runQuery(
    api.functions.predictions.queries.getModelParametersByRoute,
    { routeId }
  );

  if (!model) {
    throw new Error(`No model found for route: ${routeId}`);
  }

  // Make prediction using model coefficients
  const prediction = predictWithCoefficients(
    features,
    model.coefficients,
    model.intercept
  );

  return {
    predictedDelayMinutes: prediction,
  };
};

/**
 * Predicts delay using linear regression coefficients
 */
const predictWithCoefficients = (
  features: FeatureVector,
  coefficients: number[],
  intercept: number
): number => {
  const featureValues = Object.values(features);

  if (featureValues.length !== coefficients.length) {
    throw new Error(
      `Feature count mismatch: ${featureValues.length} vs ${coefficients.length}`
    );
  }

  const prediction = featureValues.reduce(
    (sum, value, i) => sum + value * coefficients[i],
    intercept
  );

  return prediction;
};
