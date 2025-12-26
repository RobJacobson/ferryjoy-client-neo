// ============================================================================
// TIME UTILITY FUNCTIONS
// Shared time-related functions for ML pipeline
// ============================================================================

// Timezone formatter for America/Los_Angeles (Pacific Time)
// Using Intl.DateTimeFormat ensures accurate DST handling for any year
const PACIFIC_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  weekday: "short",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/**
 * Extract Pacific time components from a UTC date using Intl API
 * This properly handles DST transitions for any year without manual calculations
 * @param utcDate - UTC date to convert
 * @returns Object with hour, minute, second, and day of week in Pacific time
 */
const getPacificTimeComponents = (
  utcDate: Date
): {
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number;
} => {
  // Format the date in Pacific timezone
  const parts = PACIFIC_TIME_FORMATTER.formatToParts(utcDate);

  // Extract components
  let hour = 0,
    minute = 0,
    second = 0,
    dayOfWeek = 0;

  for (const part of parts) {
    switch (part.type) {
      case "hour":
        hour = Number.parseInt(part.value, 10);
        break;
      case "minute":
        minute = Number.parseInt(part.value, 10);
        break;
      case "second":
        second = Number.parseInt(part.value, 10);
        break;
      case "weekday": {
        // Map weekday names to numbers (Sunday = 0)
        const weekdayMap: Record<string, number> = {
          Sun: 0,
          Mon: 1,
          Tue: 2,
          Wed: 3,
          Thu: 4,
          Fri: 5,
          Sat: 6,
        };
        dayOfWeek = weekdayMap[part.value] ?? 0;
        break;
      }
    }
  }

  return { hour, minute, second, dayOfWeek };
};

/**
 * Get a Date object representing the same moment in Pacific timezone
 * This creates a Date with Pacific time components (stored as UTC)
 * @param utcDate - UTC date to convert
 * @returns Date object (stored as UTC, but represents Pacific time values)
 */
export const getPacificTime = (utcDate: Date): Date => {
  const components = getPacificTimeComponents(utcDate);
  const year = utcDate.getUTCFullYear();
  const month = utcDate.getUTCMonth();
  const day = utcDate.getUTCDate();

  // Create a new Date with Pacific time components (stored as UTC)
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      components.hour,
      components.minute,
      components.second
    )
  );
};

/**
 * Get day of week for a UTC date in Pacific timezone
 * @param utcDate - UTC date to convert
 * @returns Day of week (0-6, where 0 = Sunday)
 */
export const getPacificDayOfWeek = (utcDate: Date): number => {
  return getPacificTimeComponents(utcDate).dayOfWeek;
};

/**
 * Calculate the time delta in minutes between two dates
 * @param startTime - Start date
 * @param endTime - End date
 * @returns Difference in minutes (can be negative if endTime < startTime)
 */
export const getMinutesDelta = (startTime: Date, endTime: Date): number =>
  (endTime.getTime() - startTime.getTime()) / (1000 * 60);

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
