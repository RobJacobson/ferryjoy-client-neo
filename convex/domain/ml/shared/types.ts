// ============================================================================
// ML - CORE TYPES (windowed training)
// ============================================================================

/**
 * Terminal abbreviation code (3-letter codes like "BBI", "EDM", "MUK").
 *
 * These are standardized abbreviations used throughout the ferry system
 * for efficient data storage and processing.
 */
export type TerminalAbbrev = string;

/**
 * Unix timestamp in milliseconds since epoch (1970-01-01T00:00:00Z).
 *
 * All time calculations in the ML pipeline use millisecond precision
 * for consistency with JavaScript Date objects and to avoid floating-point issues.
 */
export type EpochMs = number;

/**
 * Terminal pair identifier in format "FROM->TO" (e.g., "BBI->P52").
 *
 * Used to uniquely identify ferry routes between two terminals.
 * Maps to specific route characteristics and historical performance data.
 */
export type TerminalPairKey = `${TerminalAbbrev}->${TerminalAbbrev}`;

/**
 * Terminal chain identifier in format "A->B->C" (e.g., "BBI->P52->EDM").
 *
 * Represents a sequence of three connected terminal pairs that form
 * a vessel's route segment for multi-leg journey analysis.
 */
export type TerminalChainKey =
  `${TerminalAbbrev}->${TerminalAbbrev}->${TerminalAbbrev}`;

/**
 * Source of arrival time estimation.
 *
 * Currently only supports WSF (Washington State Ferries) estimated arrival times.
 * These are treated as close proxies for actual dock arrival times.
 */
export type ArrivalProxySource = "wsf_est_arrival";

export type TripLeg = {
  fromTerminalAbbrev: TerminalAbbrev;
  toTerminalAbbrev: TerminalAbbrev;

  scheduledDepartMs: EpochMs;
  actualDepartMs: EpochMs;

  /**
   * WSF historical data does not expose true arrival-at-dock. We treat EstArrival
   * as a close proxy (typically within ~1 minute of actual arrival) with noise.
   */
  arrivalProxyMs?: EpochMs;
  arrivalProxySource?: ArrivalProxySource;
};

/**
 * Base training window for a consecutive prev+curr leg pair:
 * - prev: A->Curr
 * - curr: Curr->Next
 *
 * This supports training "depart-curr" and "arrive-next" models.
 */
export type TrainingWindowBase = {
  vesselAbbrev: string;

  prevTerminalAbbrev: TerminalAbbrev; // A
  currTerminalAbbrev: TerminalAbbrev; // Curr
  nextTerminalAbbrev: TerminalAbbrev; // Next

  prevLeg: TripLeg; // A->Curr
  currLeg: TripLeg; // Curr->Next

  currPairKey: TerminalPairKey; // Curr->Next

  slackBeforeCurrScheduledDepartMinutes: number; // >= 0
  meanAtDockMinutesForCurrPair: number; // meanAtDock(Curr->Next)

  // For ordering / sampling
  currScheduledDepartMs: EpochMs;
};

export type TrainingWindowWithDepartC = TrainingWindowBase & {
  kind: "with_depart_c";

  /**
   * The next leg out of Next (Next->D). Used solely for computing "depart-next"
   * targets and eligibility (to avoid overnight-at-C contaminating depart-next
   * training).
   */
  afterTerminalAbbrev: TerminalAbbrev; // D
  nextLeg: TripLeg; // Next->D
  nextPairKey: TerminalPairKey; // Next->D

  slackBeforeNextScheduledDepartMinutes: number; // >= 0
  meanAtDockMinutesForNextPair: number; // meanAtDock(Next->D)

  isEligibleForDepartC: true;
};

export type TrainingWindowWithoutDepartC = TrainingWindowBase & {
  kind: "no_depart_c";
};

export type TrainingWindow =
  | TrainingWindowWithDepartC
  | TrainingWindowWithoutDepartC;

/**
 * Feature vector mapping feature names to numeric values.
 *
 * Contains all the engineered features used as input to ML models,
 * including time features, duration measurements, and contextual indicators.
 */
export type FeatureVector = Record<string, number>;

/**
 * A precomputed, leakage-safe feature bundle for a single training/prediction
 * example.
 *
 * - `features.atDock` includes only information available at terminal Curr before
 *   the vessel leaves the dock (no `currLeg.actualDepartMs` dependency).
 * - `features.atSea` includes `atDock` plus information available after the
 *   vessel has left the dock at Curr (but still before arrival at Next).
 *
 * Targets may reference future timestamps, but they are never included in
 * `features.*`.
 */
export type FeatureRecord = {
  currPairKey: TerminalPairKey; // Curr->Next
  currScheduledDepartMs: EpochMs;

  // Eligibility for "depart-next" (requires a valid Next->D leg).
  isEligibleForDepartC: boolean;

  features: {
    atDock: FeatureVector;
    atSea: FeatureVector;
  };

  targets: {
    // Minutes between Curr scheduled departure and Curr actual departure.
    departCurrMinutes: number;

    // Minutes from Curr scheduled departure to arrival at Next (arrival proxy).
    arriveNextFromCurrScheduledMinutes: number | null;

    // Minutes from Curr actual departure to arrival at Next (arrival proxy).
    arriveNextFromCurrActualMinutes: number | null;

    // Minutes between Next scheduled departure and Next actual departure.
    departNextFromNextScheduledMinutes: number | null;
  };
};

/**
 * Individual training example for ML model training.
 *
 * @property input - Feature vector containing all predictor variables
 * @property target - Target value to predict (in signed minutes, can be negative for early arrivals/departures)
 */
export type TrainingExample = {
  input: FeatureVector;
  target: number; // signed minutes
};

/**
 * Available ML model types for ferry schedule predictions.
 *
 * Each model combines:
 * - Timing: "at-dock" (before departure) or "at-sea" (after departure)
 * - Target: What the model predicts (depart-curr, arrive-next, depart-next)
 *
 * Model naming convention: `{timing}-{target}`
 */
export const MODEL_KEYS = [
  // Prediction models
  "at-dock-depart-curr", // Predict delay before departing current terminal
  "at-dock-arrive-next", // Predict arrival time at next terminal
  "at-dock-depart-next", // Predict delay before departing next terminal
  "at-sea-arrive-next", // Predict remaining time to next terminal (at sea)
  "at-sea-depart-next", // Predict delay at next terminal (at sea)
] as const;

export type ModelType = (typeof MODEL_KEYS)[number];

export type ModelDefinition = {
  key: ModelType;
  description: string;
  extractFeatures: (record: FeatureRecord) => FeatureVector;
  calculateTarget: (record: FeatureRecord) => number | null;
};

/**
 * Bucket identifier for grouping training data.
 *
 * Training data is grouped into buckets to train separate models for different routes:
 * - "pair": Groups by 2-terminal pairs (B->C) for route-specific models
 */
export type BucketKey = { bucketType: "pair"; pairKey: TerminalPairKey };

/**
 * Grouped training data for a specific route bucket.
 *
 * Contains all training examples for a particular terminal pair,
 * with statistics about the data volume and sampling.
 */
export type TrainingBucket = {
  /** Unique identifier for this bucket (pair or chain) */
  bucketKey: BucketKey;
  /** Training records for this bucket (after sampling) */
  records: FeatureRecord[];
  /** Statistics about the bucket's data */
  bucketStats: {
    /** Total records available before sampling */
    totalRecords: number;
    /** Records kept after sampling (limited by config.getMaxSamplesPerRoute()) */
    sampledRecords: number;
  };
};

/**
 * Trained ML model parameters and metadata.
 *
 * Contains everything needed to make predictions with a trained model,
 * including coefficients, feature ordering, and performance metrics.
 */
export type ModelParameters = {
  /** Type of ML model (determines feature extraction and target calculation) */
  modelType: ModelType;

  /** Route bucket this model was trained on (pair or chain identifier) */
  bucketKey: BucketKey;

  /** Feature names in the same order as coefficients (ensures consistent inference) */
  featureKeys: string[];

  /** Linear regression coefficients for each feature */
  coefficients: number[];
  /** Linear regression intercept term */
  intercept: number;

  /** Model performance metrics from test/validation set */
  testMetrics: {
    /** Mean Absolute Error (average prediction error in minutes) */
    mae: number;
    /** Root Mean Squared Error (penalty for large errors) */
    rmse: number;
    /** R-squared (coefficient of determination, 0-1 scale) */
    r2: number;
    /** Standard Deviation of prediction errors (measures error consistency) */
    stdDev: number;
  };

  /** Unix timestamp when model was trained */
  createdAt: number;

  /** Training data statistics for this model's bucket */
  bucketStats: TrainingBucket["bucketStats"];
};

/**
 * Result of a complete ML training pipeline run.
 *
 * Summarizes the training process and provides all trained models
 * ready for deployment to the prediction system.
 */
export type TrainingResponse = {
  /** All successfully trained models */
  models: ModelParameters[];
  /** Training pipeline statistics */
  stats: {
    /** Total training records processed across all buckets */
    totalFeatureRecords: number;
    /** Number of route buckets that had sufficient data for training */
    bucketsProcessed: number;
    /** Number of models successfully trained (may be less than buckets if some failed) */
    modelsTrained: number;
  };
};
