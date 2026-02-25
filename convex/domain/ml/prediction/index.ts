// ============================================================================
// PREDICTION ENGINE MODULE
// Real-time ML inference utilities for ferry schedule predictions
// ============================================================================

/**
 * Model application utilities for making predictions
 */
export { predictWithModel } from "./applyModel";

/**
 * ML model evaluation metrics and performance calculation
 */
export { calculateMAE, calculateR2, calculateRMSE } from "./metrics";
/**
 * Prediction lifecycle service - manages predictions end-to-end
 */
export {
  computeLeaveDockPredictions,
  handlePredictionEvent,
  type PredictionEventType,
  type PredictionLifecycleEvent,
} from "./predictionService";
/**
 * Core prediction functions for vessel trip timing
 */
export {
  predictArriveEta,
  predictDelayOnArrival,
  predictEtaOnDeparture,
  predictTripValue,
} from "./predictTrip";
/**
 * Vessel trip prediction core utilities
 */
export {
  createPredictionResult,
  getMinimumScheduledTime,
  isPredictionReadyTrip,
  PREDICTION_SPECS,
  type PredictionField,
  type PredictionSpec,
  predictFromSpec,
  updatePredictionsWithActuals,
} from "./vesselTripPredictions";
