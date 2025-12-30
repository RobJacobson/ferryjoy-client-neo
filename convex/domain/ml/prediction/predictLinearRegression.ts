// ============================================================================
// STEP 3: MAKE PREDICTION AND CONVERT TO ABSOLUTE TIME
// ============================================================================

import type { FeatureRecord, ModelParameters } from "../shared/core/types";

/**
 * Apply linear regression model to features
 * Returns predicted duration in minutes
 */
export const applyLinearRegression = (
  model: ModelParameters,
  features: FeatureRecord
): number => {
  const { coefficients, intercept } = model;

  // Build feature vector in coefficient order (must match training order)
  const featureValues: number[] = [];

  // Time features are always first: time_center_0 through time_center_7
  for (let i = 0; i < 8; i++) {
    const featureName = `time_center_${i}`;
    featureValues.push(features[featureName] ?? 0);
  }

  // Add model-specific features in the order they were trained
  // Order must match feature engineering in training step_4
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

  // Calculate prediction using linear regression formula
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
