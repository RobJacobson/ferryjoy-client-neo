// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Feature vector as name-value pairs for ML
 */
export type FeatureVector = Record<string, number>;

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
 * Minimal training data record containing only essential data for training
 */
export type TrainingDataRecord = {
  // Terminal identifiers
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;

  // Essential temporal data (only what we use for features)
  tripStart: Date; // Vessel arrival at departing terminal
  leftDock: Date; // Vessel departure from departing terminal
  tripEnd: Date; // Vessel arrival at arriving terminal
  scheduledDeparture: Date;

  // Target variables (computed)
  departureDelay: number | null; // minutes from scheduled departure (can be negative)
  atSeaDuration: number | null;
  delay: number | null; // legacy field, keep for backward compatibility
};

/**
 * Terminal pair bucket with statistics
 */
export type TerminalPairBucket = {
  terminalPair: TerminalPair;
  records: TrainingDataRecord[];
  bucketStats: {
    totalRecords: number; // Total records in bucket before filtering
    filteredRecords: number; // Records after filtering (used for training)
    meanDepartureDelay: number | null; // Average departure delay in minutes
    meanAtSeaDuration: number | null;
  };
};

/**
 * Training data for a specific terminal pair and model type
 */
export type TerminalPairTrainingData = {
  terminalPair: TerminalPair;
  modelType: "departure" | "arrival";
  examples: TrainingExample[];
};

/**
 * Enhanced ML model parameters with bucket statistics
 */
export type ModelParameters = {
  // Model data (optional for insufficient data cases)
  coefficients?: number[];
  featureNames?: string[];
  intercept?: number;

  // Required identifiers
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;
  modelType: "departure" | "arrival";

  // Training metadata
  modelAlgorithm?: string;
  trainingMetrics?: {
    mae: number;
    rmse: number;
    r2: number;
    stdDev?: number;
  };
  createdAt: number;

  // Bucket statistics (always present)
  bucketStats: {
    totalRecords: number;
    filteredRecords: number;
    meanDepartureDelay: number | null;
    meanAtSeaDuration: number | null;
  };
};

/**
 * Data quality metrics
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
  statistical: {
    durationSkewness: number;
    outlierPercentage: number;
  };
  duplicates?: {
    count: number;
  };
};

/**
 * Pipeline error types
 */
export enum PipelineErrorType {
  DATA_LOADING = "data_loading",
  DATA_QUALITY = "data_quality",
  FEATURE_ENGINEERING = "feature_engineering",
  MODEL_TRAINING = "model_training",
  STORAGE = "storage",
  VALIDATION = "validation",
}

export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly type: PipelineErrorType,
    public readonly step: string,
    public readonly bucket?: TerminalPair,
    public readonly recoverable: boolean = true,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "PipelineError";
  }
}

/**
 * Enhanced training response with error tracking
 */
export type TrainingResponse = {
  success: boolean;
  models: ModelParameters[];
  stats: {
    totalExamples: number;
    terminalPairs: string[];
    bucketsProcessed: number;
    dataQuality: DataQualityMetrics;
    terminalPairBreakdown: Record<
      string, // "DEP_ARR" format (e.g., "SEA_BRE")
      {
        departure?: {
          count: number;
          filteredRecords: number;
          avgPrediction?: number;
          stdDev?: number;
          mae?: number;
          r2?: number;
          meanDepartureDelay?: number;
        };
        arrival?: {
          count: number;
          filteredRecords: number;
          avgPrediction?: number;
          stdDev?: number;
          mae?: number;
          r2?: number;
        };
      }
    >;
  };
  errors: Array<{
    type: PipelineErrorType;
    message: string;
    step: string;
    bucket?: string;
    recoverable: boolean;
  }>;
};

/**
 * Prediction output for terminal pair models
 */
export type PredictionOutput = {
  departureDelay?: number; // minutes from scheduled departure (can be negative)
  atSeaDuration?: number; // null if no arrival model
  predictedDepartureTime?: Date; // calculated from scheduled + delay
  confidence?: {
    delayLower: number;
    delayUpper: number;
    seaLower: number;
    seaUpper: number;
  };
};
