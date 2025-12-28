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
 * Extract time-based features from scheduled departure
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
 * Extract "arrive before" features (time between arrival and scheduled departure)
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
 * Extract features for arrive-depart model
 * Used by: arrive-depart, arrive-depart-late, arrive-arrive models
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
 * Extract features for depart-arrive model
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
