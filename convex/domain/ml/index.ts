// ============================================================================
// ML MODULE EXPORTS
// ============================================================================

// Training pipeline actions
export {
  deleteAllModelsAction,
  trainPredictionModelsAction,
} from "./actions";

// Training pipeline orchestrator
export { runMLPipeline } from "./pipelineCoordinator";
export {
  predictDelayOnArrival,
  predictEtaOnArrival,
  predictEtaOnDeparture,
} from "./prediction/predictors";
export type { DelayPredictionParams } from "./prediction/predictors/types";
export type { FeatureRecord } from "./prediction/step_1_extractFeatures";
// Prediction types
export type { InitialPredictions } from "./prediction/step_4_calculateInitialPredictions";
// Prediction pipeline
export { calculateInitialPredictions } from "./prediction/step_4_calculateInitialPredictions";

// Types
export type {
  DataQualityMetrics,
  FeatureVector,
  ModelParameters,
  PredictionOutput,
  TerminalPair,
  TerminalPairBucket,
  TerminalPairTrainingData,
  TrainingDataRecord,
  TrainingExample,
  TrainingResponse,
} from "./types";
