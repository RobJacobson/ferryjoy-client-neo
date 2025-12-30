// ============================================================================
// ML MODULE EXPORTS
// Machine Learning functionality for ferry schedule predictions
// ============================================================================

// Prediction functionality
export {
  predictDelayOnArrival,
  predictEtaOnArrival,
  predictEtaOnDeparture,
} from "./prediction/predictors";

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
