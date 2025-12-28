// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Feature vector as name-value pairs for ML
 */
export type FeatureVector = Record<string, number>;

/**
 * Feature record containing extracted numeric features for ML models
 * Used during both prediction and training phases for consistent feature engineering
 */
export type FeatureRecord = Record<string, number>;

/**
 * Training example with features and target
 */
export type TrainingExample = {
  input: FeatureVector;
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
 * Training data record containing raw trip data and computed features for model training
 *
 * Each record represents a consecutive trip pair (current trip and its immediate predecessor)
 * with all necessary data for training multiple ML models that predict ferry durations and delays.
 */
export type TrainingDataRecord = {
  // Terminal pair identifiers (required for routing and model lookup)
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;

  // Previous trip metrics (context for current trip predictions)
  prevDelay: number; // Previous trip's delay in minutes from scheduled departure (can be negative for early departures)
  prevAtSeaDuration: number; // Previous trip's duration at sea in minutes (departure to arrival)

  // Current trip metrics (prediction targets)
  currAtDockDuration: number; // Current trip's at-dock duration in minutes (arrival to departure)
  currDelay: number; // Current trip's delay in minutes from scheduled departure
  currAtSeaDuration: number; // Current trip's duration at sea in minutes (departure to arrival)

  // Time-based features extracted from current trip's scheduled departure
  isWeekend: number; // 1 if scheduled departure is on weekend (Saturday/Sunday), 0 otherwise
  schedDepartureTimeFeatures: Record<string, number>; // Gaussian radial basis function features for time-of-day
  schedDepartureTimestamp: number; // Scheduled departure timestamp in milliseconds (for sorting and validation)
  arriveEarlyMinutes: number; // How many minutes early the vessel arrived at dock (relative to mean)
  arriveBeforeMinutes: number; // How many minutes before scheduled departure the vessel arrived at dock
};

/**
 * Terminal pair bucket with basic statistics
 */
export type TerminalPairBucket = {
  terminalPair: TerminalPair;
  records: TrainingDataRecord[];
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
  modelType:
    | "arrive-depart-atdock-duration"
    | "depart-arrive-atsea-duration"
    | "arrive-arrive-total-duration"
    | "depart-depart-total-duration"
    | "arrive-depart-delay";
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
  modelType:
    | "arrive-depart-atdock-duration"
    | "depart-arrive-atsea-duration"
    | "arrive-arrive-total-duration"
    | "depart-depart-total-duration"
    | "arrive-depart-delay";

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
