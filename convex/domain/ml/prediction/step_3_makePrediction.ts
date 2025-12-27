// ============================================================================
// STEP 3: MAKE PREDICTION AND CONVERT TO ABSOLUTE TIME
// ============================================================================

import type { ModelParameters } from "../types";
import type { FeatureRecord } from "./step_1_extractFeatures";

/**
 * Apply linear regression model to features
 * Returns predicted duration in minutes
 */
export const applyLinearRegression = (
  model: ModelParameters,
  features: FeatureRecord
): number => {
  const { coefficients, intercept } = model;

  // Map feature names to coefficient indices
  // Time features are time_center_0 through time_center_7
  const featureValues: number[] = [];

  // Add time features in order
  for (let i = 0; i < 8; i++) {
    const featureName = `time_center_${i}`;
    featureValues.push(features[featureName] ?? 0);
  }

  // Add additional features based on what's present in model
  if (features.prevDelay !== undefined) {
    featureValues.push(features.prevDelay);
  }
  if (features.prevAtSeaDuration !== undefined) {
    featureValues.push(features.prevAtSeaDuration);
  }
  if (features.arriveBeforeMinutes !== undefined) {
    featureValues.push(features.arriveBeforeMinutes);
  }
  if (features.atDockDuration !== undefined) {
    featureValues.push(features.atDockDuration);
  }
  if (features.delay !== undefined) {
    featureValues.push(features.delay);
  }

  // Calculate prediction: y = intercept + Σ(coefficient[i] * feature[i])
  let prediction = intercept;
  for (let i = 0; i < coefficients.length && i < featureValues.length; i++) {
    prediction += coefficients[i] * featureValues[i];
  }

  return prediction;
};

/**
 * Convert predicted delay (minutes) to absolute left dock time
 */
export const delayToLeftDockPred = (
  tripStart: number,
  predictedDelayMinutes: number
): number => {
  return tripStart + predictedDelayMinutes * 60000;
};

/**
 * Convert predicted combined duration (minutes) to absolute ETA
 */
export const combinedDurationToEtaPred = (
  tripStart: number,
  predictedDurationMinutes: number
): number => {
  return tripStart + predictedDurationMinutes * 60000;
};

/**
 * Convert predicted at-sea duration (minutes) to absolute ETA
 */
export const atSeaDurationToEtaPred = (
  leftDock: number,
  predictedAtSeaMinutes: number
): number => {
  return leftDock + predictedAtSeaMinutes * 60000;
};

/**
 * Round MAE to nearest 0.01 minute (0.6 seconds)
 */
export const roundMae = (mae: number): number => {
  return Math.round(mae * 100) / 100;
};

/**
 * Validate prediction time is not before reference time
 * Clamps to minimum valid time if prediction is too early
 */
export const validatePredictionTime = (
  predictedTime: number,
  referenceTime: number,
  minimumGapMinutes: number = 2
): number => {
  const minimumValidTime = referenceTime + minimumGapMinutes * 60000;
  return Math.max(predictedTime, minimumValidTime);
};
