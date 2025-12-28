// ============================================================================
// PREDICTION TYPES
// ============================================================================

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { ModelType } from "../../shared/core/modelTypes";
import type { FeatureRecord } from "../../shared/core/types";

/**
 * Generic prediction configuration
 */
export type PredictionConfig<TContext> = {
  modelName: ModelType;
  skipPrediction: (ctx: TContext) => boolean;
  extractFeatures: (ctx: TContext) => {
    features: FeatureRecord;
    error?: string;
  };
  convertToAbsolute: (
    predictedDuration: number,
    ctx: TContext
  ) => { absoluteTime: number; referenceTime: number; minimumGap?: number };
};

/**
 * Prediction result
 */
export type PredictionResult = {
  predictedTime?: number;
  mae?: number;
};

/**
 * Common terminal properties for all prediction contexts
 */
export type TerminalContext = {
  departingTerminal: string;
  arrivingTerminal: string;
};

/**
 * Parameters required for delay prediction
 */
export type DelayPredictionParams = {
  scheduledDeparture: number;
  departingTerminal: string;
  arrivingTerminal: string;
  tripStart: number;
  previousDelay: number;
  previousAtSeaDuration: number;
  vesselAbbrev: string;
};

/**
 * Context for predictions when a new trip starts
 */
export type NewTripContext = TerminalContext & {
  completedTrip: ConvexVesselTrip;
  newTrip: ConvexVesselTrip;
};

/**
 * Context for ETA prediction when vessel leaves dock
 */
export type DepartureContext = TerminalContext & {
  currentTrip: ConvexVesselTrip;
  currentLocation: ConvexVesselLocation;
};
