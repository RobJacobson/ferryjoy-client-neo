// ============================================================================
// FUNCTIONAL FEATURE EXTRACTION DISPATCHER
// Consolidates scattered extractors with pattern matching
// ============================================================================

import { getPacificTime } from "shared/time";
import { MEAN_AT_DOCK_DURATION } from "../core/config";
import { MODEL_TYPES, type ModelType } from "../core/modelTypes";
import type { FeatureRecord } from "../core/types";
import { extractTimeFeatures } from "./timeFeatures";

/**
 * Unified parameters for feature extraction across all model types
 *
 * This type consolidates all possible parameters needed for different prediction models,
 * providing a single interface for feature extraction in both training and prediction contexts.
 *
 * Field names match VesselTrip schema to eliminate unnecessary mapping.
 */
export type FeatureExtractionParams = {
  /** Scheduled departure timestamp (milliseconds since epoch) */
  ScheduledDeparture?: number;
  /** Previous trip's departure delay in minutes (from VesselTrip.PrevTripDelay) */
  PrevTripDelay?: number;
  /** Previous trip's at-sea duration in minutes (from VesselTrip.PrevAtSeaDuration) */
  PrevAtSeaDuration?: number;
  /** When current trip started (vessel arrival at terminal, from VesselTrip.TripStart) */
  TripStart?: number;
  /** Terminal pair identifier (e.g., "BAIN-BEL") */
  terminalPairKey?: string;
  /** Current trip's actual at-dock duration in minutes (from VesselTrip.AtDockDuration) */
  AtDockDuration?: number;
  /** Current trip's departure delay in minutes (from VesselTrip.TripDelay) */
  TripDelay?: number;
  // Training-specific fields (may be undefined for predictions)
  /** Current trip's at-dock duration (training only) */
  currAtDockDuration?: number;
  /** Current trip's at-sea duration (training only) */
  currAtSeaDuration?: number;
  /** Minutes before scheduled departure that vessel arrived */
  arriveBeforeMinutes?: number;
};

/**
 * Unified feature extraction dispatcher for all machine learning models
 *
 * Routes feature extraction to the appropriate model-specific function based on model type.
 * This ensures consistent feature engineering between training and prediction phases.
 *
 * @param modelType - The type of model for which to extract features
 * @param params - Unified parameters containing all possible feature inputs
 * @returns Normalized feature record ready for model input
 * @throws Error if model type is not recognized
 */
export const extractFeatures = (
  modelType: ModelType,
  params: FeatureExtractionParams
): FeatureRecord => {
  switch (modelType) {
    case MODEL_TYPES.ARRIVE_DEPART_ATDOCK_DURATION:
      // Predict how long vessel will spend at dock after arrival
      return extractArriveDepartAtDockFeatures(params);

    case MODEL_TYPES.DEPART_ARRIVE_ATSEA_DURATION:
      // Predict how long vessel will spend at sea after departure
      return extractDepartArriveAtSeaFeatures(params);

    case MODEL_TYPES.ARRIVE_ARRIVE_TOTAL_DURATION:
      // Predict total time from arrival at dock to arrival at next terminal
      return extractArriveArriveTotalFeatures(params);

    case MODEL_TYPES.ARRIVE_DEPART_DELAY:
      // Predict departure delay after vessel arrives at terminal
      return extractArriveDepartDelayFeatures(params);

    case MODEL_TYPES.DEPART_DEPART_TOTAL_DURATION:
      // Predict total duration between consecutive departures
      return extractDepartDepartTotalFeatures(params);

    default:
      throw new Error(`Unknown model type: ${modelType}`);
  }
};

/**
 * Extract timing features related to how early/late vessel arrives at terminal
 *
 * Calculates arrival timing relative to scheduled departure, which is crucial
 * for predicting departure delays and at-dock durations.
 *
 * @param tripStart - When vessel arrived at terminal (trip start time)
 * @param scheduledDeparture - Scheduled departure timestamp
 * @param terminalPairKey - Terminal pair identifier for mean duration lookup
 * @returns Arrival timing features: minutes before schedule and early arrival adjustment
 */
export const extractArriveBeforeFeatures = (
  tripStart: number,
  scheduledDeparture: number,
  terminalPairKey: string
): { arriveBeforeMinutes: number; arriveEarlyMinutes: number } => {
  const schedDepartDate = new Date(scheduledDeparture);
  const tripStartDate = new Date(tripStart);

  // Positive = arrived early, Negative = arrived late
  const arriveBeforeMinutes =
    (schedDepartDate.getTime() - tripStartDate.getTime()) / 60000;

  // Get historical average at-dock duration for this terminal pair
  const meanAtDockDuration = MEAN_AT_DOCK_DURATION[terminalPairKey];

  // How much "extra" time vessel has (positive if early, negative if late)
  const arriveEarlyMinutes = arriveBeforeMinutes - meanAtDockDuration;

  return { arriveBeforeMinutes, arriveEarlyMinutes };
};

/**
 * Extract features for arrive-depart-atdock-duration model
 */
export const extractArriveDepartAtDockFeatures = (
  params: FeatureExtractionParams
): FeatureRecord => {
  const { timeFeatures, isWeekend } = extractTimeBasedFeatures(
    params.ScheduledDeparture
  );
  return {
    ...timeFeatures,
    isWeekend,
    prevDelay: params.PrevTripDelay ?? 0,
    prevAtSeaDuration: params.PrevAtSeaDuration ?? 0,
    arriveBeforeMinutes: params.arriveBeforeMinutes ?? 0,
  };
};

/**
 * Extract features for depart-arrive-atsea-duration model
 */
export const extractDepartArriveAtSeaFeatures = (
  params: FeatureExtractionParams
): FeatureRecord => {
  const { timeFeatures, isWeekend } = extractTimeBasedFeatures(
    params.ScheduledDeparture
  );
  return {
    ...timeFeatures,
    isWeekend,
    atDockDuration: params.AtDockDuration ?? 0,
    delay: params.TripDelay ?? 0,
  };
};

/**
 * Extract features for depart-depart-total-duration model
 */
export const extractDepartDepartTotalFeatures = (
  params: FeatureExtractionParams
): FeatureRecord => {
  const { timeFeatures, isWeekend } = extractTimeBasedFeatures(
    params.ScheduledDeparture
  );
  return {
    ...timeFeatures,
    isWeekend,
    prevDelay: params.PrevTripDelay ?? 0,
    prevAtSeaDuration: params.PrevAtSeaDuration ?? 0,
  };
};

/**
 * Extract features for arrive-arrive-total-duration model
 */
export const extractArriveArriveTotalFeatures = (
  params: FeatureExtractionParams
): FeatureRecord => {
  const { timeFeatures, isWeekend } = extractTimeBasedFeatures(
    params.ScheduledDeparture
  );
  return {
    ...timeFeatures,
    isWeekend,
    prevDelay: params.PrevTripDelay ?? 0,
    prevAtSeaDuration: params.PrevAtSeaDuration ?? 0,
    arriveBeforeMinutes: params.arriveBeforeMinutes ?? 0,
  };
};

/**
 * Extract features for arrive-depart-delay model
 */
export const extractArriveDepartDelayFeatures = (
  params: FeatureExtractionParams
): FeatureRecord => {
  const { timeFeatures, isWeekend } = extractTimeBasedFeatures(
    params.ScheduledDeparture
  );
  const { arriveBeforeMinutes } =
    params.TripStart && params.ScheduledDeparture && params.terminalPairKey
      ? extractArriveBeforeFeatures(
          params.TripStart,
          params.ScheduledDeparture,
          params.terminalPairKey
        )
      : { arriveBeforeMinutes: 0 };

  return {
    ...timeFeatures,
    isWeekend,
    prevDelay: params.PrevTripDelay ?? 0,
    prevAtSeaDuration: params.PrevAtSeaDuration ?? 0,
    arriveBeforeMinutes,
  };
};

/**
 * Extract time-based features common to all prediction models
 *
 * Generates cyclical time features (sine/cosine) for hour-of-day and day-of-year
 * to capture temporal patterns in ferry schedules without hard boundaries.
 *
 * @param scheduledDeparture - Scheduled departure timestamp
 * @returns Object containing time features and weekend indicator
 */
export const extractTimeBasedFeatures = (
  scheduledDeparture: number | undefined
): { timeFeatures: Record<string, number>; isWeekend: number } => {
  const schedDepartDate = new Date(scheduledDeparture || 0);
  const pacificTime = getPacificTime(schedDepartDate);

  // Extract cyclical time features (sin/cos transformations)
  const timeFeatures = extractTimeFeatures(pacificTime);
  const dayOfWeek = schedDepartDate.getDay();
  // Weekend indicator: 1 for Saturday/Sunday, 0 for weekdays
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;

  return { timeFeatures, isWeekend };
};
