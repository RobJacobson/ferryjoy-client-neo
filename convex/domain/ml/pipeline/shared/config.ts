// ============================================================================
// PIPELINE CONFIGURATION
// ============================================================================

/**
 * Valid passenger terminal abbreviations
 */
export const VALID_PASSENGER_TERMINALS = new Set([
  "ANA",
  "BBI",
  "BRE",
  "CLI",
  "COU",
  "EDM",
  "FAU",
  "FRH",
  "KIN",
  "LOP",
  "MUK",
  "ORI",
  "P52",
  "POT",
  "PTD",
  "SHI",
  "SID",
  "SOU",
  "TAH",
  "VAI",
]);

/**
 * Pipeline configuration constants
 */
export const PIPELINE_CONFIG = {
  // Data loading
  BATCH_SIZE: 1000,
  MAX_LOAD_RETRIES: 3,
  DAYS_BACK: 90, // Days of historical data for WSF training

  // Data quality
  MIN_TRAINING_EXAMPLES: 25,
  MAX_SCHEDULE_DELTA_MINUTES: 30,
  REQUIRED_COMPLETENESS_THRESHOLD: 0.7,

  // Model training
  CROSS_VALIDATION_FOLDS: 5,
  MODEL_ALGORITHM: "multivariate-linear-regression",
  RANDOM_SEED: 42,

  // Error handling
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_BACKOFF_MS: 1000,
} as const;

/**
 * Training configuration
 */
export const TRAINING_CONFIG = {
  // Feature engineering
  MAX_SCHEDULE_DELTA_CLAMP: 20,

  // Model validation
  OVERFITTING_R2_THRESHOLD: 0.99,
  SUSPICIOUS_MAE_RATIO_THRESHOLD: 0.01,

  // Performance monitoring
  EXPECTED_TRAINING_TIME_PER_RECORD_MS: 1,
  MAX_TRAINING_TIME_PER_BUCKET_MS: 30000, // 30 seconds
} as const;

/**
 * Data quality thresholds
 */
export const QUALITY_THRESHOLDS = {
  MIN_COMPLETENESS_SCORE: 0.7,
  MAX_TEMPORAL_INCONSISTENCY_RATE: 0.2,
  MAX_OUTLIER_RATE: 0.1,
} as const;
