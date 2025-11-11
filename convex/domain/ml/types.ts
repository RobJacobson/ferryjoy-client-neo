import type { ActiveVesselTrip } from "@domain";

import type { ConvexCompletedVesselTrip } from "../../functions/completedVesselTrips/schemas";

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Vessel trip with all required fields guaranteed to be present
 * This is a runtime-validated subset of VesselTrip
 */
export type ValidatedTrip = ActiveVesselTrip & {
  OpRouteAbbrev: string;
  ArrivingTerminalID: number;
  ArrivingTerminalName: string;
  ArrivingTerminalAbbrev: string;
  ScheduledDeparture: Date;
  ArvDockActual: Date;
  LeftDock: Date;
  Eta: Date;
  TimeStamp: Date;
  LeftDockDelay: number;
};

/**
 * Pair of consecutive vessel trips for feature extraction
 */
export type TripPair = {
  prevTrip: ValidatedTrip;
  currTrip: ValidatedTrip;
  routeId: string;
};

/**
 * Feature vector as name-value pairs for ML
 */
export type FeatureVector = Record<string, number>;

/**
 * Training example with features and target
 */
export type TrainingExample = {
  input: FeatureVector;
  target: number; // delay in minutes
};

/**
 * ML model parameters
 */
export type ModelParameters = {
  coefficients: number[];
  featureNames: string[];
  intercept: number;
  routeId: string;
};

/**
 * Training response
 */
export type TrainingResponse = {
  success: boolean;
  models: ModelParameters[];
  stats: {
    totalExamples: number;
    routes: string[];
    routeBreakdown: Record<
      string,
      {
        count: number;
        avgPrediction: number;
        stdDev: number;
        mae: number;
        r2: number;
      }
    >;
  };
};

/**
 * Prediction output
 */
export type PredictionOutput = {
  predictedDelayMinutes: number;
  confidence?: number;
};
