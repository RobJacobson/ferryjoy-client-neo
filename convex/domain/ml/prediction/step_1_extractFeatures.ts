// ============================================================================
// STEP 1: EXTRACT FEATURES FOR PREDICTION
// Feature extraction from vessel trips for ML models
// ============================================================================

import { getPacificTime } from "../../../shared/time";
import { MEAN_AT_DOCK_DURATION } from "../training/shared/config";
import { extractTimeFeatures } from "../training/shared/time";

/**
 * Feature record for ML prediction
 */
export type FeatureRecord = Record<string, number>;

/**
 * Extract time-of-day and weekend features from scheduled departure timestamp
 *
 * @param scheduledDeparture - Scheduled departure timestamp in milliseconds (can be undefined)
 * @returns Object containing Gaussian radial basis time features and weekend indicator
 */
export const extractTimeBasedFeatures = (
  scheduledDeparture: number | undefined
): { timeFeatures: Record<string, number>; isWeekend: number } => {
  const schedDepartDate = new Date(scheduledDeparture || 0);
  const pacificTime = getPacificTime(schedDepartDate);

  const timeFeatures = extractTimeFeatures(pacificTime);
  const dayOfWeek = schedDepartDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;

  return { timeFeatures, isWeekend };
};

/**
 * Extract timing features related to vessel arrival relative to scheduled departure
 *
 * @param tripStart - Timestamp when vessel arrived at dock (trip start)
 * @param scheduledDeparture - Scheduled departure timestamp
 * @param terminalPairKey - Terminal pair key for looking up mean at-dock duration
 * @returns Object with arriveBeforeMinutes and arriveEarlyMinutes features
 */
export const extractArriveBeforeFeatures = (
  tripStart: number,
  scheduledDeparture: number | undefined,
  terminalPairKey: string
): { arriveBeforeMinutes: number; arriveEarlyMinutes: number } => {
  const schedDepartDate = new Date(scheduledDeparture || 0);
  const tripStartDate = new Date(tripStart);

  const arriveBeforeMinutes =
    (schedDepartDate.getTime() - tripStartDate.getTime()) / 60000;

  const meanAtDockDuration = MEAN_AT_DOCK_DURATION[terminalPairKey] || 0;
  const arriveEarlyMinutes = meanAtDockDuration - arriveBeforeMinutes;

  return { arriveBeforeMinutes, arriveEarlyMinutes };
};

/**
 * Extract features for models that use arrival context (arrive-depart-delay, arrive-arrive-total-duration)
 *
 * Combines time-based features, previous trip metrics, and arrival timing to create
 * a comprehensive feature set for predicting delays and durations when vessels arrive at dock.
 *
 * @param scheduledDeparture - Scheduled departure timestamp for the current trip
 * @param prevDelay - Delay from the previous trip in minutes
 * @param prevAtSeaDuration - At-sea duration from the previous trip in minutes
 * @param tripStart - Timestamp when current trip started (vessel arrived at dock)
 * @param terminalPairKey - Terminal pair identifier for duration lookups
 * @returns Complete feature record for arrive-depart model types
 */
export const extractArriveDepartFeatures = (
  scheduledDeparture: number | undefined,
  prevDelay: number,
  prevAtSeaDuration: number,
  tripStart: number,
  terminalPairKey: string
): FeatureRecord => {
  const { timeFeatures, isWeekend } =
    extractTimeBasedFeatures(scheduledDeparture);
  const { arriveBeforeMinutes } = extractArriveBeforeFeatures(
    tripStart,
    scheduledDeparture,
    terminalPairKey
  );

  return {
    ...timeFeatures,
    isWeekend,
    prevDelay,
    prevAtSeaDuration,
    arriveBeforeMinutes,
  };
};

/**
 * Extract features for depart-arrive-atsea-duration model
 *
 * Creates feature set for predicting at-sea duration using actual at-dock duration
 * and scheduled departure context. Used when vessels depart from dock.
 *
 * @param scheduledDeparture - Scheduled departure timestamp
 * @param atDockDuration - Actual time spent at dock in minutes
 * @param delay - Actual delay from scheduled departure in minutes
 * @returns Feature record for depart-arrive model predictions
 */
export const extractDepartArriveFeatures = (
  scheduledDeparture: number | undefined,
  atDockDuration: number | undefined,
  delay: number | undefined
): FeatureRecord => {
  const { timeFeatures, isWeekend } =
    extractTimeBasedFeatures(scheduledDeparture);

  return {
    ...timeFeatures,
    isWeekend,
    atDockDuration: atDockDuration || 0,
    delay: delay || 0,
  };
};
