// ============================================================================
// METRICS CALCULATION UTILITIES
// Functions for calculating ML model performance metrics
// ============================================================================

/**
 * Calculate Mean Absolute Error (MAE)
 * Average of absolute differences between predicted and actual values
 */
export const calculateMAE = (actual: number[], predicted: number[]): number => {
  if (actual.length !== predicted.length) {
    throw new Error("Actual and predicted arrays must have the same length");
  }

  const sum = actual.reduce((acc, actualVal, i) => {
    return acc + Math.abs(actualVal - predicted[i]);
  }, 0);

  return sum / actual.length;
};

/**
 * Calculate Root Mean Square Error (RMSE)
 * Square root of the average of squared differences between predicted and actual values
 */
export const calculateRMSE = (
  actual: number[],
  predicted: number[]
): number => {
  if (actual.length !== predicted.length) {
    throw new Error("Actual and predicted arrays must have the same length");
  }

  const sum = actual.reduce((acc, actualVal, i) => {
    const diff = actualVal - predicted[i];
    return acc + diff * diff;
  }, 0);

  return Math.sqrt(sum / actual.length);
};

/**
 * Calculate R-squared (coefficient of determination)
 * Proportion of variance in dependent variable explained by the model
 */
export const calculateR2 = (actual: number[], predicted: number[]): number => {
  if (actual.length !== predicted.length) {
    throw new Error("Actual and predicted arrays must have the same length");
  }

  const n = actual.length;
  const actualMean = actual.reduce((sum, val) => sum + val, 0) / n;

  const ssRes = actual.reduce((sum, actualVal, i) => {
    const diff = actualVal - predicted[i];
    return sum + diff * diff;
  }, 0);

  const ssTot = actual.reduce((sum, actualVal) => {
    const diff = actualVal - actualMean;
    return sum + diff * diff;
  }, 0);

  return 1 - ssRes / ssTot;
};

/**
 * Calculate Standard Deviation of Errors
 * Measures the spread/consistency of prediction errors around the mean
 */
export const calculateStdDevErrors = (
  actual: number[],
  predicted: number[]
): number => {
  if (actual.length !== predicted.length) {
    throw new Error("Actual and predicted arrays must have the same length");
  }

  if (actual.length < 2) {
    return 0; // Cannot calculate standard deviation with less than 2 samples
  }

  // Calculate errors (residuals)
  const errors = actual.map((actualVal, i) => actualVal - predicted[i]);

  // Calculate mean of errors
  const meanError = errors.reduce((sum, err) => sum + err, 0) / errors.length;

  // Calculate variance of errors
  const variance =
    errors.reduce((sum, err) => {
      const diff = err - meanError;
      return sum + diff * diff;
    }, 0) /
    (errors.length - 1); // Use sample standard deviation (n-1)

  return Math.sqrt(variance);
};
