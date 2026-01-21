// ============================================================================
// FEATURE EXTRACTION UTILITIES
// Time-based feature engineering for ferry schedule prediction ML models
// ============================================================================

/**
 * ## Feature Engineering Overview
 *
 * This module extracts predictive features from vessel trip data for ML training and inference.
 * Features capture temporal patterns, schedule deviations, and operational context that
 * influence ferry departure and arrival times.
 *
 * ## Feature Categories
 *
 * 1. **Time Features**: Smooth time-of-day representations using radial basis functions
 * 2. **Duration Features**: Historical averages and actual trip durations
 * 3. **Schedule Features**: Slack time, delays, and schedule adherence
 * 4. **Context Features**: Previous trip performance and arrival patterns
 *
 * ## Key Concepts
 *
 * - **Slack Time**: Minutes between vessel arrival and scheduled departure
 * - **Late Arrival Pressure**: How schedule pressure affects departure delays
 * - **Regime Classification**: In-service vs layover based on available time
 */

import { getPacificTimeComponents } from "shared";
import { config, formatTerminalPairKey } from "./config";
import type { UnifiedTrip } from "./unifiedTrip";

/**
 * Extracted features from a unified trip record.
 *
 * Contains all engineered features used for ML predictions,
 * organized by category for different model types.
 */
export type Features = ReturnType<typeof extractFeatures>;

/**
 * Extract comprehensive feature set from a vessel trip record.
 *
 * This function transforms raw trip data into ML-ready features by:
 * 1. Converting scheduled departure to time-of-day features
 * 2. Calculating arrival schedule deviations
 * 3. Computing slack time and delay metrics
 * 4. Incorporating previous trip context
 *
 * @param trip - Unified trip record with all necessary timing data
 * @returns Comprehensive feature object for ML models
 */
export function extractFeatures(trip: UnifiedTrip) {
  // Extract time-of-day features using radial basis functions
  const schedDepartDate = new Date(trip.ScheduledDeparture);
  const pacific = getPacificTimeComponents(schedDepartDate);
  const timeFeatures = extractTimeFeatures(pacific);

  // Calculate previous leg context for arrival time estimation
  const prevLegPairKey = formatTerminalPairKey(
    trip.PrevTerminalAbbrev,
    trip.DepartingTerminalAbbrev
  );
  const prevLegMeanAtSeaMinutes = config.getMeanAtSeaDuration(prevLegPairKey);

  // Estimate when vessel should have arrived based on previous leg schedule + historical duration
  const estimatedArrivalAtDepartingTerminal =
    trip.PrevScheduledDeparture + prevLegMeanAtSeaMinutes * 60000;

  // Measure how actual arrival deviated from the expected schedule-based arrival
  const arrivalVsEstimatedScheduleMinutes = getMinutesDelta(
    estimatedArrivalAtDepartingTerminal,
    trip.TripStart
  );

  // Calculate slack time: available time between arrival and scheduled departure
  // Key "mode" signals available at arrival time (TripStart) even before LeftDock
  // - slackBeforeDepartureMinutes: how many minutes between dock arrival and sched depart (>= 0)
  // - arrivalAfterScheduledDepartureMinutes: how many minutes late the vessel arrived relative to sched depart (>= 0)
  const slackBeforeDepartureMinutes = Math.max(
    0,
    getMinutesDelta(trip.TripStart, trip.ScheduledDeparture)
  );
  const arrivalAfterScheduledDepartureMinutes = Math.max(
    0,
    getMinutesDelta(trip.ScheduledDeparture, trip.TripStart)
  );

  // Split arrival deviation into positive (late) and negative (early) components
  const arrivalAfterEstimatedScheduleMinutes = Math.max(
    0,
    arrivalVsEstimatedScheduleMinutes
  );
  const arrivalBeforeEstimatedScheduleMinutes = Math.max(
    0,
    -arrivalVsEstimatedScheduleMinutes
  );

  return {
    timeFeatures, // Time-of-day features (12 radial basis functions)
    isWeekend: pacific.dayOfWeek === 0 || pacific.dayOfWeek === 6 ? 1 : 0, // Binary weekend indicator
    tripDelay: getMinutesDelta(trip.ScheduledDeparture, trip.LeftDock), // Actual delay from scheduled departure
    atDockDuration: getMinutesDelta(trip.TripStart, trip.LeftDock), // Time spent at dock
    atSeaDuration: getMinutesDelta(trip.LeftDock, trip.TripEnd), // Time spent at sea
    totalDuration: getMinutesDelta(trip.TripStart, trip.TripEnd), // Total trip duration
    prevLegMeanAtSeaMinutes, // Historical average duration for previous leg
    arrivalVsEstimatedScheduleMinutes, // Signed deviation from expected arrival time
    arrivalAfterEstimatedScheduleMinutes, // Minutes late vs expected (≥ 0)
    arrivalBeforeEstimatedScheduleMinutes, // Minutes early vs expected (≥ 0)
    slackBeforeDepartureMinutes, // Available time before scheduled departure
    arrivalAfterScheduledDepartureMinutes, // How late arrival was vs scheduled departure
    prevTripDelay: getMinutesDelta(
      // Delay on the previous trip
      trip.PrevScheduledDeparture,
      trip.PrevLeftDock
    ),
    prevAtSeaDuration: getMinutesDelta(trip.PrevLeftDock, trip.TripStart), // Previous leg actual duration
    // FEATURE_GROUP: MeanAtDockDerived (DISABLED)
    // lateArrival: lateArrival(trip, slackBeforeDepartureMinutes), // Schedule pressure feature (clamped at 1.5x mean)
  };
}

/**
 * Calculate a late-arrival "pressure" feature with experimental clamping.
 *
 * This feature captures how schedule pressure influences departure delays.
 * The intuition is:
 * - If vessel arrives with plenty of slack before scheduled departure,
 *   schedule adherence dominates and delay should be minimal
 * - If slack is low (tight schedule), operational factors (loading/unloading)
 *   dominate and delays become less predictable
 *
 * Modified Formula: max(0, 1.5 × averageTurnaroundMinutes - slackBeforeDepartureMinutes)
 * - Experiment: Clamp early departures at 1.5x mean at-dock time to increase layover sensitivity
 * - Returns 0 when slack >= 1.5x average turnaround (no pressure)
 * - Increases as slack decreases, maxing at 1.5x averageTurnaroundMinutes when slack = 0
 *
 * @param trip - Vessel trip data
 * @param slackBeforeDepartureMinutes - Available time before scheduled departure
 * @returns Schedule pressure value (≥ 0)
 */
// FEATURE_GROUP: MeanAtDockDerived (DISABLED)
// const lateArrival = (
//   trip: UnifiedTrip,
//   slackBeforeDepartureMinutes: number
// ): number => {
//   // This calculation uses only arrival time + schedule, so it's available at prediction
//   // time when actual departure (LeftDock) isn't known yet
//   if (!trip.TripStart || !trip.ScheduledDeparture) {
//     return 0;
//   }
//
//   // Get historical average turnaround time for this route (B->C)
//   const averageTurnaroundMinutes = config.getMeanAtDockDuration(
//     formatTerminalPairKey(
//       trip.DepartingTerminalAbbrev,
//       trip.ArrivingTerminalAbbrev
//     )
//   );
//
//   // Calculate pressure: how much below 1.5x average turnaround time we are
//   // Experiment: Clamp early departures at 1.5x mean at-dock time to increase layover sensitivity
//   // Higher values indicate tighter schedules and more operational pressure
//   const maxPressure = 1.5 * averageTurnaroundMinutes;
//   return Math.max(0, maxPressure - slackBeforeDepartureMinutes);
// };

/**
 * Calculate time delta in minutes between two timestamps
 *
 * @param earlier - Earlier timestamp (in milliseconds)
 * @param later - Later timestamp (in milliseconds)
 * @returns Time difference in minutes
 */
const getMinutesDelta = (
  earlier: number | undefined,
  later: number | undefined
) => {
  if (!earlier || !later) {
    return 0;
  }
  return (later - earlier) / 60000;
};

// Every 2 hours
const centers = Array(12)
  .fill(null)
  .map((_, index) => index * 2);

/**
 * Extract smooth time-of-day features using radial basis functions.
 *
 * Creates 12 Gaussian radial basis functions centered every 2 hours (0:00, 2:00, ..., 22:00)
 * to capture daily patterns in ferry schedules. This smooth representation allows the model
 * to learn time-of-day effects while being robust to slight schedule variations.
 *
 * Each feature represents activation strength at a particular time of day:
 * - Values range from 0 (far from center) to 1 (at center)
 * - Overlapping Gaussians ensure smooth transitions
 * - Standard deviation is set to provide good coverage while maintaining specificity
 *
 * @param schedDeparturePacificTime - Scheduled departure time in Pacific timezone
 * @returns Time features as key-value pairs (e.g., "time_0:00": 0.123, "time_2:00": 0.045)
 */
export const extractTimeFeatures = (schedDeparturePacificTime: {
  hour: number;
  minute: number;
}): Record<string, number> => {
  // Convert time to decimal hours (e.g., 14:30 = 14.5)
  const hourOfDay =
    schedDeparturePacificTime.hour + schedDeparturePacificTime.minute / 60;

  // Calculate standard deviation for Gaussian functions
  // For N centers in 24 hours: spacing = 24/N, sigma = spacing * 0.5 provides good overlap
  // With 12 centers (every 2 hours), sigma = 1.0 for smooth transitions
  const sigma = (24 / centers.length) * 0.5;

  // Generate radial basis function features for each time center
  const features = centers.reduce(
    (acc, center) => {
      const weight = getTimeFeature(hourOfDay, center, sigma);
      acc[`time_${center}:00`] = weight;
      return acc;
    },
    {} as Record<string, number>
  );

  return features;
};

/**
 * Calculate Gaussian radial basis function activation for time-of-day features.
 *
 * Uses circular distance to handle day boundaries correctly (24-hour wraparound).
 * Formula: exp(-(distance²) / (2σ²)) where distance is the minimum angular distance.
 *
 * @param hourOfDay - Time as decimal hours (0-24)
 * @param center - Center of the Gaussian (hour 0, 2, 4, ..., 22)
 * @param sigma - Standard deviation controlling spread of the Gaussian
 * @returns Activation value between 0 and 1
 */
const getTimeFeature = (hourOfDay: number, center: number, sigma: number) => {
  // Calculate minimum distance considering 24-hour circular nature
  // e.g., distance between 23:00 and 1:00 is 2 hours, not 22 hours
  const distance = Math.min(
    Math.abs(hourOfDay - center),
    24 - Math.abs(hourOfDay - center)
  );
  return Math.exp(-(distance * distance) / (2 * sigma * sigma));
};
