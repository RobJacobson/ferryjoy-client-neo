// ============================================================================
// UNIFIED FEATURE EXTRACTORS
// Combines training and prediction feature extraction
// ============================================================================

import { getPacificTime } from "shared/time";
import { MEAN_AT_DOCK_DURATION } from "../core/config";
import type { FeatureRecord, TrainingDataRecord } from "../core/types";
import { extractTimeFeatures } from "./timeFeatures";

/**
 * Extract time-based features common to all models
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
 * Extract timing features for arrival context
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
 * Extract features for arrive-depart-atdock-duration model
 */
export const extractArriveDepartAtDockFeatures = (
  record: TrainingDataRecord
): FeatureRecord => ({
  ...extractTimeBasedFeatures(record.schedDepartureTimestamp).timeFeatures,
  isWeekend: extractTimeBasedFeatures(record.schedDepartureTimestamp).isWeekend,
  prevDelay: record.prevDelay,
  prevAtSeaDuration: record.prevAtSeaDuration,
  arriveBeforeMinutes: record.arriveBeforeMinutes,
});

/**
 * Extract features for depart-arrive-atsea-duration model
 */
export const extractDepartArriveAtSeaFeatures = (
  scheduledDeparture?: number,
  atDockDuration?: number,
  delay?: number
): FeatureRecord => {
  const { timeFeatures, isWeekend } =
    extractTimeBasedFeatures(scheduledDeparture);
  return {
    ...timeFeatures,
    isWeekend,
    atDockDuration: atDockDuration ?? 0,
    delay: delay ?? 0,
  };
};

/**
 * Extract features for arrive-arrive-total-duration model
 */
export const extractArriveArriveTotalFeatures = (
  record: TrainingDataRecord
): FeatureRecord => ({
  ...extractTimeBasedFeatures(record.schedDepartureTimestamp).timeFeatures,
  isWeekend: extractTimeBasedFeatures(record.schedDepartureTimestamp).isWeekend,
  prevDelay: record.prevDelay,
  prevAtSeaDuration: record.prevAtSeaDuration,
  arriveBeforeMinutes: record.arriveBeforeMinutes,
});

/**
 * Extract features for arrive-depart-delay model
 */
export const extractArriveDepartDelayFeatures = (
  record: TrainingDataRecord
): FeatureRecord => ({
  ...extractTimeBasedFeatures(record.schedDepartureTimestamp).timeFeatures,
  isWeekend: extractTimeBasedFeatures(record.schedDepartureTimestamp).isWeekend,
  prevDelay: record.prevDelay,
  prevAtSeaDuration: record.prevAtSeaDuration,
  arriveBeforeMinutes: record.arriveBeforeMinutes,
});

/**
 * Extract features for arrive-depart models (prediction context)
 */
export const extractArriveDepartFeatures = (
  scheduledDeparture?: number,
  prevDelay?: number,
  prevAtSeaDuration?: number,
  tripStart?: number,
  terminalPairKey?: string
): FeatureRecord => {
  const { timeFeatures, isWeekend } =
    extractTimeBasedFeatures(scheduledDeparture);
  const { arriveBeforeMinutes } = extractArriveBeforeFeatures(
    tripStart ?? 0,
    scheduledDeparture,
    terminalPairKey ?? ""
  );

  return {
    ...timeFeatures,
    isWeekend,
    prevDelay: prevDelay ?? 0,
    prevAtSeaDuration: prevAtSeaDuration ?? 0,
    arriveBeforeMinutes,
  };
};
