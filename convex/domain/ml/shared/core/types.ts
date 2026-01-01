// ============================================================================
// CORE TYPES
// ============================================================================

import type { Features } from "../features";
import type { ModelType } from "../models";
export type { ModelType };

/**
 * Feature record containing extracted numeric features for ML models
 * Used during both prediction and training phases for consistent feature engineering
 */
export type FeatureRecord = Record<string, number>;

/**
 * Result of feature extraction including features and explicit ordering
 * Used to guarantee consistent feature ordering between training and prediction
 */
export type FeatureExtractionResult = {
  features: FeatureRecord;
  featureKeys: readonly string[];
};

/**
 * Training example with features and target
 */
export type TrainingExample = {
  input: FeatureRecord;
  target: number; // duration in minutes (at_dock, at_sea, or combined durations)
};

/**
 * Terminal pair identifier
 */
export type TerminalPair = {
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;
};

/**
 * Training data with terminal pair information
 */
export type TrainingDataWithTerminals = {
  terminalPair: {
    departingTerminalAbbrev: string;
    arrivingTerminalAbbrev: string;
  };
  scheduledDeparture: number; // For sorting by recency
  features: Features;
};

/**
 * Terminal pair bucket with basic statistics
 */
export type TerminalPairBucket = {
  terminalPair: TerminalPair;
  features: Features[];
  bucketStats: {
    totalRecords: number;
    filteredRecords: number;
    meanDepartureDelay?: number;
    meanAtSeaDuration?: number;
    meanDelay?: number;
  };
};

/**
 * Training data for a specific terminal pair and model type
 */
export type TerminalPairTrainingData = {
  terminalPair: TerminalPair;
  modelType: ModelType;
  examples: TrainingExample[];
};

/**
 * Trained machine learning model parameters for linear regression
 *
 * Contains all data needed to make predictions for a specific terminal pair and model type.
 * Linear regression models always include coefficients and intercept arrays.
 */
export type ModelParameters = {
  // Model data - always set for valid linear regression models
  coefficients: number[];
  intercept: number;

  // Required identifiers
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;
  modelType: ModelType;

  // Training metrics - always set after training
  trainingMetrics: {
    mae: number;
    rmse: number;
    r2: number;
    stdDev?: number;
  };

  // Creation timestamp
  createdAt: number;

  // Basic bucket statistics
  bucketStats: {
    totalRecords: number;
    filteredRecords: number;
    meanDepartureDelay?: number;
    meanAtSeaDuration?: number;
    meanDelay?: number;
  };

  // Optional evaluation metrics (only set when holdout evaluation succeeds)
  evaluation?: {
    strategy: "time_split";
    foldsUsed: number;
    holdout: { mae: number; rmse: number; r2: number };
  };
};

/**
 * Basic data quality metrics
 */
export type DataQualityMetrics = {
  totalRecords: number;
  completeness: {
    overallScore: number;
    fieldCompleteness: Record<string, number>;
  };
  temporal: {
    validOrdering: number;
    invalidRecords: number;
  };
};

/**
 * Simplified training response
 */
export type TrainingResponse = {
  models: ModelParameters[];
  stats: {
    totalExamples: number;
    terminalPairs: string[];
    bucketsProcessed: number;
    dataQuality: DataQualityMetrics;
  };
};

/**
 * Prediction output for terminal pair models
 */
export type PredictionOutput = {
  atDockDuration?: number; // minutes from arrival at dock to departure (arrive-depart-atdock-duration model)
  atSeaDuration?: number; // minutes from departure to arrival (depart-arrive-atsea-duration model)
  combinedDuration?: number; // minutes from departure at A to departure at B (arrive-arrive-total-duration model)
  predictedDepartureTime?: Date; // calculated from scheduled + delay (if applicable)
};
