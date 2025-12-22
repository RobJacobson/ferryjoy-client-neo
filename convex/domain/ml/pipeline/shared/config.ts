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
 * Simplified pipeline configuration - only essential settings
 */
export const PIPELINE_CONFIG = {
  // Data loading
  DAYS_BACK: 365, // Days of historical data for WSF training

  // Model training
  MIN_TRAINING_EXAMPLES: 25,
  MODEL_ALGORITHM: "multivariate-linear-regression",
} as const;
