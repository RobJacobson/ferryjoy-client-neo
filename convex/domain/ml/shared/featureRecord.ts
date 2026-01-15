// ============================================================================
// ML - FEATURE RECORD PREPROCESSING
// Builds leakage-safe (atDock / atSea) features + targets from a TrainingWindow
// ============================================================================

/**
 * ## Feature Record Creation Overview
 *
 * Transforms training windows into ML-ready feature records with temporal safety.
 *
 * ## Feature Record Structure
 *
 * Each record contains:
 * - **Core metadata**: Terminal pair, scheduled departure time, regime
 * - **Feature sets**: `atDock` and `atSea` feature vectors (leakage-safe)
 * - **Targets**: Prediction targets for different model types
 *
 * ## Temporal Safety (Leakage Prevention)
 *
 * Features are carefully separated by information availability:
 * - **atDock**: Available when vessel arrives at terminal
 * - **atSea**: Available after vessel departs (includes atDock + departure info)
 *
 * ## Business Logic Integration
 *
 * Features capture operational realities:
 * - Schedule adherence patterns
 * - Terminal-specific turnaround times
 * - Previous trip performance impact
 * - Time-of-day operational patterns
 */

import { getPacificTimeComponents } from "shared";
import { config, formatTerminalPairKey } from "./config";
import { extractTimeFeatures } from "./features";
import type {
  FeatureRecord,
  TrainingWindow,
  TrainingWindowWithDepartC,
} from "./types";

/**
 * Calculate time difference in minutes between two timestamps.
 *
 * @param earlierMs - Earlier timestamp in milliseconds
 * @param laterMs - Later timestamp in milliseconds
 * @returns Time difference in minutes (can be negative if later comes before earlier)
 */
const minutesBetween = (earlierMs: number, laterMs: number): number =>
  (laterMs - earlierMs) / 60000;

/**
 * Extract time-based features from a scheduled departure timestamp.
 *
 * Creates time-of-day features using radial basis functions and weekend indicators
 * that capture daily operational patterns in ferry schedules.
 *
 * @param scheduledDepartMs - Scheduled departure timestamp in milliseconds
 * @returns Object containing time features and weekend indicator
 */
const getTimeContext = (scheduledDepartMs: number) => {
  const pacific = getPacificTimeComponents(new Date(scheduledDepartMs));
  return {
    timeFeatures: extractTimeFeatures(pacific), // 12 radial basis function features
    isWeekend: pacific.dayOfWeek === 0 || pacific.dayOfWeek === 6 ? 1 : 0, // Binary weekend flag
  };
};

/**
 * Extract features related to the previous leg's performance and arrival patterns.
 *
 * Analyzes how the vessel arrived at the current terminal (B) from the previous terminal (A),
 * including schedule deviations, transit performance, and delay propagation effects.
 *
 * @param window - Training window containing previous and current leg data
 * @returns Object with previous leg context features
 */
const getPrevLegContextAtCurr = (window: TrainingWindow) => {
  const arrivalAtCurrMs = window.prevLeg.arrivalProxyMs ?? 0;

  const prevPairKey = formatTerminalPairKey(
    window.prevTerminalAbbrev,
    window.currTerminalAbbrev
  );
  const meanAtSeaPrevMinutes = config.getMeanAtSeaDuration(prevPairKey);
  const estimatedArrivalAtCurrMs =
    window.prevLeg.scheduledDepartMs + meanAtSeaPrevMinutes * 60000;

  const arrivalVsEstimatedScheduleMinutes = minutesBetween(
    estimatedArrivalAtCurrMs,
    arrivalAtCurrMs
  );

  const prevTripDelayMinutes = minutesBetween(
    window.prevLeg.scheduledDepartMs,
    window.prevLeg.actualDepartMs
  );
  const prevAtSeaDurationMinutes = arrivalAtCurrMs
    ? minutesBetween(window.prevLeg.actualDepartMs, arrivalAtCurrMs)
    : 0;

  return {
    arrivalAtCurrMs,
    meanAtSeaPrevMinutes,
    atSeaDelay: prevAtSeaDurationMinutes - meanAtSeaPrevMinutes,
    arrivalVsEstimatedScheduleMinutes,
    arrivalAfterEstimatedScheduleMinutes: Math.max(
      0,
      arrivalVsEstimatedScheduleMinutes
    ),
    arrivalBeforeEstimatedScheduleMinutes: Math.max(
      0,
      -arrivalVsEstimatedScheduleMinutes
    ),
    prevTripDelayMinutes,
    prevAtSeaDurationMinutes,
  };
};

/**
 * Arrival-time regime cues (ported from v1 feature set).
 *
 * These are computed at terminal Curr and are available at "at dock" time (and
 * remain known at "at sea" time).
 */
const getDockCuesAtCurr = (window: TrainingWindow) => {
  const arrivalAtCurrMs = window.prevLeg.arrivalProxyMs ?? 0;

  // v1: arrivalAfterScheduledDepartureMinutes = max(0, arrivalAtCurr - schedDepartCurr)
  const arrivalAfterScheduledDepartureMinutes = arrivalAtCurrMs
    ? Math.max(
        0,
        minutesBetween(window.currLeg.scheduledDepartMs, arrivalAtCurrMs)
      )
    : 0;

  // v1 "lateArrival" (pressure) feature:
  // max(0, meanAtDock(Curr->Next) - slackBeforeDepartureMinutes)
  const lateArrival = Math.max(
    0,
    window.meanAtDockMinutesForCurrPair -
      window.slackBeforeCurrScheduledDepartMinutes
  );

  return {
    arrivalAfterScheduledDepartureMinutes,
    lateArrival,
  };
};

/**
 * Extract route-specific historical averages for the current leg.
 *
 * Provides baseline expectations for at-dock and at-sea durations based on
 * historical performance data for the specific terminal pair (B→C).
 *
 * @param window - Training window with current leg route information
 * @returns Historical mean durations for the current route
 */
const getCurrLegRoutePriors = (window: TrainingWindow) => {
  const meanAtSeaCurrMinutes = config.getMeanAtSeaDuration(window.currPairKey);
  const meanAtDockCurrMinutes = config.getMeanAtDockDuration(
    window.currPairKey
  );
  return { meanAtSeaCurrMinutes, meanAtDockCurrMinutes };
};

/**
 * Extract features that become available only after vessel departs current terminal.
 *
 * These features represent the actual performance of the current terminal operations
 * and are only known once the vessel has left the dock. They provide refined
 * context for at-sea predictions but cannot depend on arrival at the next terminal.
 *
 * **Temporal Safety**: Does not include any arrival-dependent data to prevent
 * data leakage in at-sea prediction scenarios.
 *
 * @param window - Training window with current leg departure information
 * @returns Actual performance metrics from current terminal operations
 */
const getCurrSeaActuals = (window: TrainingWindow) => {
  const arrivalAtCurrMs = window.prevLeg.arrivalProxyMs ?? 0;

  const currTripDelayMinutes = minutesBetween(
    window.currLeg.scheduledDepartMs,
    window.currLeg.actualDepartMs
  );
  const currAtDockDurationMinutes = arrivalAtCurrMs
    ? minutesBetween(arrivalAtCurrMs, window.currLeg.actualDepartMs)
    : 0;

  return {
    currTripDelayMinutes,
    currAtDockDurationMinutes,
  };
};

/**
 * Type guard for windows that include next-terminal departure context.
 *
 * Used to safely access depart-next features that require multi-leg journey data.
 */
const requireDepartNextWindow = (
  window: TrainingWindow
): window is TrainingWindowWithDepartC =>
  window.kind === "with_depart_c" && window.isEligibleForDepartC;

/**
 * Create ML-ready feature record from training window.
 *
 * This is the core feature engineering function that transforms raw trip data
 * into structured feature vectors while maintaining temporal safety (no data leakage).
 *
 * ## Feature Engineering Process
 *
 * 1. **Time Context**: Extract time-of-day features and weekend indicators
 * 2. **Route Priors**: Get historical averages for current route
 * 3. **Previous Leg Context**: Analyze prior trip performance and arrival patterns
 * 4. **Terminal Cues**: Calculate schedule pressure and operational indicators
 * 5. **Temporal Separation**: Create atDock/atSea feature variants
 * 6. **Layover Variants**: Generate reduced feature sets for extended stops
 * 7. **Target Calculation**: Compute prediction targets for each model type
 *
 * @param window - Training window with vessel journey context
 * @returns Feature record ready for ML training or inference
 */
export const createFeatureRecord = (window: TrainingWindow): FeatureRecord => {
  // Extract contextual features from the training window
  const time = getTimeContext(window.currLeg.scheduledDepartMs); // Time-of-day features
  const priors = getCurrLegRoutePriors(window); // Historical route averages
  const prev = getPrevLegContextAtCurr(window); // Previous leg performance
  const cues = getDockCuesAtCurr(window); // Schedule pressure indicators

  // Build at-dock feature set (available when vessel arrives at terminal)
  // Includes all contextual information except post-departure actuals
  const atDock = {
    ...time.timeFeatures,
    isWeekend: time.isWeekend,

    slackBeforeCurrScheduledDepartMinutes:
      window.slackBeforeCurrScheduledDepartMinutes,

    meanAtSeaCurrMinutes: priors.meanAtSeaCurrMinutes,
    meanAtDockCurrMinutes: priors.meanAtDockCurrMinutes,

    atSeaDelay: prev.atSeaDelay,
    arrivalVsEstimatedScheduleMinutes: prev.arrivalVsEstimatedScheduleMinutes,
    arrivalAfterEstimatedScheduleMinutes:
      prev.arrivalAfterEstimatedScheduleMinutes,
    arrivalBeforeEstimatedScheduleMinutes:
      prev.arrivalBeforeEstimatedScheduleMinutes,

    arrivalAfterScheduledDepartureMinutes:
      cues.arrivalAfterScheduledDepartureMinutes,
    lateArrival: cues.lateArrival,

    prevTripDelayMinutes: prev.prevTripDelayMinutes,
    prevAtSeaDurationMinutes: prev.prevAtSeaDurationMinutes,
  };

  // Extract features that become available after departure
  const seaActuals = getCurrSeaActuals(window);

  // Build at-sea feature set (extends at-dock with post-departure actuals)
  // Includes all at-dock features plus actual terminal performance metrics
  const atSea = {
    ...atDock, // All pre-departure context
    ...seaActuals, // Actual departure delay and at-dock duration
  };

  // Extract arrival timestamp for target calculations
  const arrivalAtNextMs = window.currLeg.arrivalProxyMs ?? 0;

  // Return complete feature record with metadata, feature sets, and targets
  return {
    // Core metadata for bucketing and filtering
    currPairKey: window.currPairKey, // Terminal pair (B→C) for route-specific models
    currScheduledDepartMs: window.currScheduledDepartMs, // Timestamp for time-based features
    isEligibleForDepartC: requireDepartNextWindow(window), // Multi-leg context availability

    // Feature sets organized by prediction timing
    features: { atDock, atSea },

    // Prediction targets (what each model type aims to predict)
    targets: {
      // Current terminal departure delay (primary prediction target)
      departCurrMinutes: minutesBetween(
        window.currLeg.scheduledDepartMs,
        window.currLeg.actualDepartMs
      ),

      // Arrival at next terminal from current scheduled departure
      // Used for "arrive-next" models in at-dock prediction context
      arriveNextFromCurrScheduledMinutes: arrivalAtNextMs
        ? minutesBetween(window.currLeg.scheduledDepartMs, arrivalAtNextMs)
        : null,

      // Arrival at next terminal from current actual departure
      // Used for "arrive-next" models in at-sea prediction context
      arriveNextFromCurrActualMinutes: arrivalAtNextMs
        ? minutesBetween(window.currLeg.actualDepartMs, arrivalAtNextMs)
        : null,

      // Next terminal departure delay (requires 3-leg context)
      // Only available when next leg data is present and eligible
      departNextFromNextScheduledMinutes: requireDepartNextWindow(window)
        ? minutesBetween(
            window.nextLeg.scheduledDepartMs,
            window.nextLeg.actualDepartMs
          )
        : null,
    },
  };
};

/**
 * Transform an array of training windows into ML-ready feature records.
 *
 * Applies feature engineering to each training window in the dataset,
 * converting raw trip data into structured feature vectors suitable for
 * machine learning training and inference.
 *
 * @param windows - Array of training windows from data processing pipeline
 * @returns Array of feature records ready for ML model training
 */
export const createFeatureRecords = (
  windows: TrainingWindow[]
): FeatureRecord[] => windows.map(createFeatureRecord);
