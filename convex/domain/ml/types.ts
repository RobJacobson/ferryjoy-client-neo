// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Feature vector as name-value pairs for ML
 */
export type FeatureVector = Record<string, number>;

/**
 * Feature record for feature extraction (used in prediction and training)
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
 * Training data record containing both features and targets for model training
 */
export type TrainingDataRecord = {
  // Terminal identifiers (needed for pipeline operations)
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;

  // Target variables for training
  prevDelay: number; // minutes from previous trip's scheduled departure (can be negative)
  prevAtSeaDuration: number; // minutes from previous trip's departure to previous trip's arrival (for depart-depart target)
  currAtDockDuration: number; // minutes from arrival at B to departure from B (current trip)
  currDelay: number; // minutes from scheduled departure to actual departure (current trip)
  currAtSeaDuration: number; // minutes from departure to arrival (current trip)

  // Time features extracted from scheduled departure
  isWeekend: number; // 1 if the scheduled departure is on a weekend, 0 otherwise
  schedDepartureTimeFeatures: Record<string, number>; // Time-of-day features from scheduled departure time
  schedDepartureTimestamp: number; // Timestamp (milliseconds) of scheduled departure for chronological sorting
  arriveEarlyMinutes: number; // minutes early the vessel arrived at the dock
  arriveBeforeMinutes: number; // minutes before the scheduled departure the vessel arrived at the dock
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
    | "arrive-depart"
    | "depart-arrive"
    | "arrive-arrive"
    | "depart-depart"
    | "arrive-depart-late";
  examples: TrainingExample[];
};

/**
 * Simplified ML model parameters
 * Linear regression models always have coefficients and intercept set
 */
export type ModelParameters = {
  // Model data - always set for valid linear regression models
  coefficients: number[];
  intercept: number;

  // Required identifiers
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;
  modelType:
    | "arrive-depart"
    | "depart-arrive"
    | "arrive-arrive"
    | "depart-depart"
    | "arrive-depart-late";

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
  atDockDuration?: number; // minutes from arrival at dock to departure (arrive-depart model)
  atSeaDuration?: number; // minutes from departure to arrival (depart-arrive model)
  combinedDuration?: number; // minutes from departure at A to departure at B (depart-depart model)
  predictedDepartureTime?: Date; // calculated from scheduled + delay (if applicable)
};
