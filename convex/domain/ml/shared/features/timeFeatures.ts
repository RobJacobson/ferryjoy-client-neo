// ============================================================================
// ML-SPECIFIC TIME UTILITY FUNCTIONS
// Time-related functions specific to ML feature engineering and training
// ============================================================================

/**
 * Round very small values to zero to clean up numerical noise
 * @param value - Value to potentially round to zero
 * @param threshold - Absolute value threshold below which value becomes zero (default: 1e-6 for coefficient noise)
 */
export const roundTinyValues = (
  value: number,
  threshold: number = 1e-6
): number => {
  return Math.abs(value) < threshold ? 0 : value;
};

/**
 * Create smooth time-of-day features using Gaussian radial basis functions
 * Evenly distributed centers every 3 hours for comprehensive daily coverage
 */
const getTimeOfDaySmooth = (
  schedDeparturePacificTime: Date
): Record<string, number> => {
  const hourOfDay =
    schedDeparturePacificTime.getHours() +
    schedDeparturePacificTime.getMinutes() / 60;

  // Every 3 hours, with peaks around 8:00 AM and 5:00 PM
  const centers = [2, 5, 8, 11, 14, 17, 20, 23];

  // Adaptive standard deviation based on center spacing
  // For N centers in 24 hours: spacing = 24/N, sigma = spacing * 0.5 for good overlap
  const sigma = (12 / centers.length) * 0.5;

  const features: Record<string, number> = {};

  centers.forEach((center, index) => {
    // Calculate minimum distance considering 24-hour wraparound
    const distance = Math.min(
      Math.abs(hourOfDay - center),
      24 - Math.abs(hourOfDay - center)
    );

    // Gaussian radial basis function
    const weight = Math.exp(-(distance * distance) / (2 * sigma * sigma));

    features[`time_center_${index}`] = weight;
  });

  return features;
};

/**
 * Extract and clean time-of-day features from a date
 * Shared between extractFeatures and extractFeaturesForDepartDepart
 */
export const extractTimeFeatures = (
  schedDeparturePacificTime: Date
): Record<string, number> => {
  const timeFeatures = getTimeOfDaySmooth(schedDeparturePacificTime);
  const cleanedTimeFeatures: Record<string, number> = {};
  for (const [key, value] of Object.entries(timeFeatures)) {
    cleanedTimeFeatures[key] = roundTinyValues(value);
  }
  return cleanedTimeFeatures;
};
