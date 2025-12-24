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
 * Mean at-dock duration (in minutes) for each terminal pair
 * Values truncated to 2 decimal places from training-results.csv
 */
export const MEAN_AT_DOCK_DURATION: Record<string, number> = {
  ANA_FRH: 26.74,
  ANA_LOP: 26.65,
  ANA_ORI: 26.33,
  ANA_SHI: 23.2,
  BBI_P52: 18.5,
  BRE_P52: 18.55,
  CLI_MUK: 16.38,
  COU_POT: 17.94,
  EDM_KIN: 23.94,
  FAU_SOU: 15.99,
  FAU_VAI: 15.42,
  FRH_ANA: 26.28,
  FRH_LOP: 27.22,
  FRH_ORI: 23.39,
  FRH_SHI: 20.82,
  KIN_EDM: 24.18,
  LOP_ANA: 12.63,
  LOP_FRH: 10.02,
  LOP_ORI: 12.87,
  LOP_SHI: 10.7,
  MUK_CLI: 15.4,
  ORI_ANA: 19.52,
  ORI_FRH: 12.09,
  ORI_LOP: 20.88,
  ORI_SHI: 21.99,
  P52_BBI: 21.17,
  P52_BRE: 18.93,
  POT_COU: 21.07,
  PTD_TAH: 17.39,
  SHI_ANA: 6.23,
  SHI_LOP: 6.2,
  SHI_ORI: 6.76,
  SOU_FAU: 10.55,
  SOU_VAI: 14.67,
  TAH_PTD: 13.68,
  VAI_FAU: 14.12,
  VAI_SOU: 10.99,
} as const;

/**
 * Minimum duration thresholds (in minutes) for data quality filtering
 */
export const MIN_DURATION_THRESHOLDS = {
  AT_SEA: 2.0, // Minimum at-sea duration (vessel must be at sea for at least 2 minutes)
  AT_DOCK: 2.0, // Minimum at-dock duration (vessel must be at dock for at least 2 minutes)
} as const;

/**
 * Maximum duration thresholds (in minutes) for data quality filtering
 * Used to filter out overnight layovers, extended maintenance periods, etc.
 */
export const MAX_DURATION_THRESHOLDS = {
  AT_DOCK: 60.0, // Maximum at-dock duration (60 minutes) - filters out overnight layovers
  AT_SEA: 90.0, // Maximum at-sea duration (90 minutes) - filters out data errors
  ARRIVE_ARRIVE_TOTAL: 120.0, // Maximum total arrive-arrive duration (2 hours) - filters out extreme outliers
} as const;

/**
 * Simplified pipeline configuration - only essential settings
 */
export const PIPELINE_CONFIG = {
  // Data loading
  DAYS_BACK: 720, // Days of historical data for WSF training
  MAX_RECORDS_PER_VESSEL: 5000, // Limit records per vessel to manage memory
  MAX_SAMPLES_PER_ROUTE: 2500, // Maximum samples per terminal pair (keeps most recent) - 80/20 split gives 1600 train / 400 test
  SAMPLING_STRATEGY: "recent_first", // "recent_first" prioritizes recent data

  // When storing linear model coefficients, zero-out extremely tiny values.
  // This reduces noise (e.g. ~1e-10) and slightly shrinks stored model size without
  // meaningfully affecting predictions (times are in minutes).
  COEFFICIENT_ROUNDING_ZERO_THRESHOLD: 1e-6,

  // Evaluation (used by training scripts to compute out-of-sample metrics)
  EVALUATION: {
    enabled: true,
    trainRatio: 0.8, // 80% for training, 20% for testing
    minTrainExamples: 200,
  },
} as const;
