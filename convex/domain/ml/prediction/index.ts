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
 * Core prediction functions for vessel trip timing
 */
export {
  predictArriveEta,
  predictDelayOnArrival,
  predictEtaOnDeparture,
  predictTripValue,
} from "./predictTrip";

/**
 * Vessel trip prediction orchestration and lifecycle management
 */
export {
  computeVesselTripPredictionsPatch,
  predictVesselTripPrediction,
  updatePredictionsWithActuals,
} from "./vesselTripPredictions";
