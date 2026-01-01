// ============================================================================
// ML MODULE EXPORTS
// Machine Learning functionality for ferry schedule predictions
// ============================================================================

// Shared functionality (types, config, model types, features)
/**
 * Core ML types, configuration constants, and model type definitions
 */
export * from "./shared";

// Training functionality
// ML Actions (model management)
/**
 * Action to train prediction models using the complete ML pipeline
 */
export { trainPredictionModelsAction } from "./training/actions";
