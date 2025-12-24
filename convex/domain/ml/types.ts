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
export type FeatureRecord = {
  // Essential temporal data for feature extraction
  prevDelay: number; // Minutes from previous trip's actual departure to previous trip's estimated arrival
  tripStart: Date; // Vessel arrival at departing terminal (or current time reference)
  schedDeparture: Date; // Scheduled departure time
  meanAtDockDuration: number; // Minutes from departure to arrival at next terminal

  // Prediction-specific fields (only available during prediction)
  delayMinutes?: number; // Current delay in minutes (for depart-arrive models)
  leftDock?: Date; // Actual departure time (for depart-arrive models)
  prevLeftDock?: Date; // Actual departure time from previous trip (for depart-depart models)
};

/**
 * Training example with features and target
 */
export type TrainingExample = {
  input: FeatureVector;
  target: number; // duration in minutes (at_dock or at_sea)
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
export type TrainingDataRecord = FeatureRecord & {
  // Terminal identifiers (needed for pipeline operations)
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;

  // Additional temporal data for validation
  tripEnd: Date;
  leftDock: Date; // Actual departure time

  // Target variables for training
  departureDelay: number; // minutes from scheduled departure (can be negative)
  atSeaDuration: number; // minutes from departure to arrival
  atDockDuration: number; // minutes from arrival at B to departure from B (for arrive-arrive target)
  prevLeftDock: Date; // Actual departure time from previous trip (for depart-depart features)
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
    | "depart-depart";
  examples: TrainingExample[];
};

/**
 * Simplified ML model parameters
 */
export type ModelParameters = {
  // Model data (optional for insufficient data cases)
  // For linear models: coefficients and intercept
  // For tree-based models: these may be empty
  coefficients?: number[];
  intercept?: number;

  // Required identifiers
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;
  modelType:
    | "arrive-depart"
    | "depart-arrive"
    | "arrive-arrive"
    | "depart-depart";

  // Training metrics (matching database schema)
  trainingMetrics?: {
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

  // Optional evaluation metrics (holdout evaluation)
  evaluation?: {
    strategy: "time_split" | "insufficient_data";
    foldsUsed: number;
    holdout: {
      mae: number;
      rmse: number;
      r2: number;
    };
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
  departureDelay?: number; // minutes from scheduled departure (can be negative)
  atSeaDuration?: number; // null if no arrival model
  predictedDepartureTime?: Date; // calculated from scheduled + delay
};
