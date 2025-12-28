// ============================================================================
// ML MODULE EXPORTS
// Machine Learning functionality for ferry schedule predictions
// ============================================================================

// Prediction functionality
export type { InitialPredictions } from "./prediction/predictOnArrival";
/**
 * Calculates initial predictions for ferry arrivals based on historical data
 * @deprecated Use individual predictor functions for better control
 */
export { calculateArrivalPredictions as calculateInitialPredictions } from "./prediction/predictOnArrival";
/**
 * Predicts delay on arrival at a terminal
 */
/**
 * Predicts estimated time of arrival based on vessel position and historical patterns
 */
/**
 * Predicts estimated time of arrival based on departure time and conditions
 */
export {
  predictDelayOnArrival,
  predictEtaOnArrival,
  predictEtaOnDeparture,
} from "./prediction/predictors";

export type { DelayPredictionParams } from "./prediction/predictors/types";

// Shared functionality (types, config, model types, features)
/**
 * Core ML types, configuration constants, and model type definitions
 */
export * from "./shared";

export type { FeatureRecord } from "./shared/core/types";

// Training functionality
/**
 * Runs the complete machine learning training pipeline
 */
export { runMLPipeline } from "./training";
// ML Actions (model management)
/**
 * Action to delete all trained models from the database
 */
/**
 * Action to train prediction models using the complete ML pipeline
 */
export {
  deleteAllModelsAction,
  trainPredictionModelsAction,
} from "./training/actions";
