// ============================================================================
// SHARED FEATURE ENGINEERING UTILITIES
// Unified feature extraction for training and prediction
// ============================================================================

import type { VesselTrip } from "functions/vesselTrips/schemas";
import type { FeatureRecord, FeatureVector } from "../../types";
import { getPacificTime } from "./time";

/**
 * Convert a VesselTrip to a FeatureRecord for feature extraction
 * Used during training to standardize input format
 */
/**
 * Convert a VesselTrip to a FeatureRecord for feature extraction
 * Used during training to standardize input format
 */
export const vesselTripToFeatureRecord = (trip: VesselTrip): FeatureRecord => {
  if (!trip.TripStart || !trip.ScheduledDeparture) {
    throw new Error(
      "VesselTrip must have TripStart and ScheduledDeparture for feature extraction"
    );
  }

  return {
    tripStart: trip.TripStart,
    schedDeparture: trip.ScheduledDeparture,
    prevLeftDock: null, // Not available in single VesselTrip
    prevSchedDeparture: null, // Not available in single VesselTrip
    delayMinutes: trip.Delay || 0,
    leftDock: trip.LeftDock || undefined,
  };
};

/**
 * Extract features for ML models using FeatureRecord
 */
export const extractFeatures = (input: FeatureRecord): FeatureVector => {
  const scheduleDelta = calculateScheduleDelta(input);
  const scheduleDeltaClamped = Math.min(20, Math.max(-Infinity, scheduleDelta));
  const schedDeparturePacificTime = getPacificTime(input.schedDeparture);

  const dayOfWeek = schedDeparturePacificTime.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Time of day as continuous features (0-24, handles daily cycle)

  // Base features available in both contexts
  const features: FeatureVector = {
    schedule_delta_clamped: scheduleDeltaClamped,
    // Smooth time-of-day features (continuous, handles nearby times)
    ...getTimeOfDaySmooth(schedDeparturePacificTime),
    is_weekend: isWeekend ? 1 : 0,
  };

  // Add delay_minutes for arrival models (available in FeatureRecord from prediction)
  if (input.delayMinutes !== undefined) {
    features.delay_minutes = input.delayMinutes;
  }

  return features;
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

  // Every 2 hours (12 centers) - higher resolution
  const centers = Array.from({ length: 12 }, (_, i) => i * 2.0);

  // Adaptive standard deviation based on center spacing
  // For N centers in 24 hours: spacing = 24/N, sigma = spacing * 0.5 for good overlap
  const sigma = (24 / centers.length) * 0.5;

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
 * Calculate schedule delta in minutes (positive = ahead of schedule)
 */
const calculateScheduleDelta = (input: FeatureRecord): number => {
  const actualMs = input.tripStart.getTime();
  const scheduledMs = input.schedDeparture.getTime();
  return (scheduledMs - actualMs) / (1000 * 60); // Convert to minutes
};
