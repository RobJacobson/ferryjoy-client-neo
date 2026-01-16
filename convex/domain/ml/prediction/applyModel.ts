// ============================================================================
// MODEL APPLICATION UTILITIES
// Functions for applying trained ML models to make predictions
// ============================================================================

/**
 * Make a prediction using linear regression coefficients and intercept
 *
 * @param features - Array of feature values
 * @param coefficients - Trained model coefficients
 * @param intercept - Trained model intercept
 * @returns Predicted value
 */
export const predictWithModel = (
  features: number[],
  coefficients: number[],
  intercept: number
): number => {
  if (features.length !== coefficients.length) {
    throw new Error(
      `Feature array length (${features.length}) must match coefficients array length (${coefficients.length})`
    );
  }

  // Linear regression: y = coefficients · features + intercept
  const prediction = features.reduce((sum, feature, i) => {
    return sum + feature * coefficients[i];
  }, intercept);

  return prediction;
};
