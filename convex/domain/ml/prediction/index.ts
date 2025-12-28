// ============================================================================
// PREDICTION PIPELINE EXPORTS
// Machine learning prediction functionality for ferry schedules
// ============================================================================

/**
 * Core linear regression prediction engine and utilities
 */
export * from "./predictLinearRegression";

/**
 * Initial predictions calculation for ferry arrivals
 * @deprecated Use individual predictor functions for better performance
 */
export * from "./predictOnArrival";

/**
 * Individual predictor functions for specific prediction types:
 * - predictDelayOnArrival: Predict delays when vessel arrives at terminal
 * - predictEtaOnArrival: Predict ETA based on current vessel position
 * - predictEtaOnDeparture: Predict ETA based on departure conditions
 */
export * from "./predictors";
