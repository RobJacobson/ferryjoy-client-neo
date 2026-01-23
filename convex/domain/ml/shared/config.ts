// ============================================================================
// FUNCTIONAL CONFIGURATION SYSTEM
// Centralized configuration with functional lenses
// ============================================================================

/**
 * Functional configuration access patterns
 * Simplified lens-like getters for nested configuration
 */

/**
 * ## ML Configuration System
 *
 * Centralized configuration for the ferry schedule prediction ML pipeline.
 * Contains terminal mappings, historical duration statistics, and training parameters.
 *
 * ## Data Sources
 * - **Terminal mappings**: Derived from WSF (Washington State Ferries) system
 * - **Duration statistics**: Calculated from historical vessel trip data (720 days back)
 * - **Thresholds**: Determined through statistical analysis and business requirements
 *
 * ## Duration Data Methodology
 * - **At-dock duration**: Time between vessel arrival at terminal and departure
 * - **At-sea duration**: Time between departure and arrival at next terminal
 * - **Statistics**: Computed as averages across all historical trips for each route
 */
export const ML_CONFIG = {
  terminals: {
    /**
     * Valid terminal abbreviations in the WSF system.
     *
     * These 3-letter codes represent all active ferry terminals
     * across Puget Sound and San Juan Islands routes.
     */
    valid: new Set([
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
    ]),
    /**
     * Terminal name to abbreviation mapping.
     *
     * Maps full terminal names from WSF data to standardized 3-letter codes.
     * Handles common variations and alternative spellings.
     */
    mapping: {
      // Puget Sound region
      Bainbridge: "BBI",
      "Bainbridge Island": "BBI",
      Bremerton: "BRE",
      Kingston: "KIN",
      Edmonds: "EDM",
      Mukilteo: "MUK",
      Clinton: "CLI",
      Fauntleroy: "FAU",
      Vashon: "VAI",
      "Vashon Island": "VAI",
      Colman: "P52",
      Seattle: "P52",
      Southworth: "SOU",
      "Pt. Defiance": "PTD",
      "Point Defiance": "PTD",
      Tahlequah: "TAH",

      // San Juan Islands
      Anacortes: "ANA",
      Friday: "FRH",
      "Friday Harbor": "FRH",
      Shaw: "SHI",
      "Shaw Island": "SHI",
      Orcas: "ORI",
      "Orcas Island": "ORI",
      Lopez: "LOP",
      "Lopez Island": "LOP",

      // Other
      "Port Townsend": "POT",
      Keystone: "COU",
    } as Record<string, string>,
    /**
     * Historical mean at-dock durations by terminal pair (in minutes).
     *
     * Represents average time vessels spend at terminals between arrival and departure.
     * Calculated from 720 days of historical WSF data. Used for:
     * - Feature engineering (regime classification)
     * - Prediction baseline calculations
     * - Layover vs in-service regime determination
     */
    meanAtDockDuration: {
      "ANA->FRH": 26.74,
      "ANA->LOP": 26.65,
      "ANA->ORI": 26.33,
      "ANA->SHI": 23.2,
      "BBI->P52": 18.5,
      "BRE->P52": 18.55,
      "CLI->MUK": 16.38,
      "COU->POT": 17.94,
      "EDM->KIN": 23.94,
      "FAU->SOU": 15.99,
      "FAU->VAI": 15.42,
      "FRH->ANA": 26.28,
      "FRH->LOP": 27.22,
      "FRH->ORI": 23.39,
      "FRH->SHI": 20.82,
      "KIN->EDM": 24.18,
      "LOP->ANA": 12.63,
      "LOP->FRH": 10.02,
      "LOP->ORI": 12.87,
      "LOP->SHI": 10.7,
      "MUK->CLI": 15.4,
      "ORI->ANA": 19.52,
      "ORI->FRH": 12.09,
      "ORI->LOP": 20.88,
      "ORI->SHI": 21.99,
      "P52->BBI": 21.17,
      "P52->BRE": 18.93,
      "POT->COU": 21.07,
      "PTD->TAH": 17.39,
      "SHI->ANA": 6.23,
      "SHI->LOP": 6.2,
      "SHI->ORI": 6.76,
      "SOU->FAU": 10.55,
      "SOU->VAI": 14.67,
      "TAH->PTD": 13.68,
      "VAI->FAU": 14.12,
      "VAI->SOU": 10.99,
    } as Record<string, number>,
    /**
     * Historical mean at-sea durations by terminal pair (in minutes).
     *
     * Represents average transit time between terminals.
     * Calculated from 720 days of historical WSF data. Used for:
     * - Estimating expected arrival times
     * - Calculating arrival schedule deviations
     * - Feature engineering for prediction models
     */
    meanAtSeaDuration: {
      "ANA->FRH": 68.9,
      "ANA->LOP": 42.8,
      "ANA->ORI": 54.8,
      "ANA->SHI": 50.0,
      "BBI->P52": 31.8,
      "BRE->P52": 55.8,
      "CLI->MUK": 14.6,
      "COU->POT": 27.4,
      "EDM->KIN": 21.8,
      "FAU->SOU": 21.6,
      "FAU->VAI": 14.5,
      "FRH->ANA": 71.9,
      "FRH->LOP": 35.7,
      "FRH->ORI": 40.8,
      "FRH->SHI": 43.4,
      "KIN->EDM": 21.9,
      "LOP->ANA": 45.1,
      "LOP->FRH": 36.8,
      "LOP->ORI": 18.1,
      "LOP->SHI": 18.5,
      "MUK->CLI": 14.6,
      "ORI->ANA": 53.9,
      "ORI->FRH": 44.1,
      "ORI->LOP": 19.9,
      "ORI->SHI": 9.3,
      "P52->BBI": 32.8,
      "P52->BRE": 57.0,
      "POT->COU": 27.1,
      "PTD->TAH": 13.6,
      "SHI->ANA": 53.5,
      "SHI->LOP": 19.1,
      "SHI->ORI": 9.2,
      "SOU->FAU": 21.9,
      "SOU->VAI": 12.1,
      "TAH->PTD": 12.0,
      "VAI->FAU": 14.8,
      "VAI->SOU": 11.4,
    } as Record<string, number>,
  },
  /**
   * Data quality and business rule thresholds.
   *
   * These thresholds filter out anomalous data and enforce business constraints
   * to ensure training data quality and realistic predictions.
   */
  thresholds: {
    /**
     * Duration validation thresholds (in minutes).
     *
     * Used to filter out invalid or anomalous trip data during training:
     * - Min thresholds remove data entry errors and micro-trips
     * - Max thresholds prevent inclusion of extreme outliers
     * - Total threshold prevents unrealistic end-to-end journey times
     */
    duration: {
      atSea: { min: 2.0, max: 90.0 },
      atDock: { min: 2.0, max: 45.0 },
      arriveArriveTotal: { max: 120.0 },
    },
  },
  /**
   * ML training pipeline configuration.
   *
   * Controls data loading, training parameters, and evaluation settings.
   */
  pipeline: {
    /**
     * Training data loading parameters.
     *
     * Determines how much historical data to include in training:
     * - daysBack: How far back to look (720 days = ~2 years)
     * - maxRecordsPerVessel: Prevents any single vessel from dominating training
     * - maxSamplesPerRoute: Limits samples per route to prevent overfitting
     * - samplingStrategy: "recent_first" prioritizes recent data for relevance
     */
    dataLoading: {
      daysBack: 365,
      maxRecordsPerVessel: 7500,
      maxSamplesPerRoute: 7500,
      samplingStrategy: "recent_first",
    },
    /**
     * Model training parameters.
     *
     * Controls the training process and model optimization:
     * - coefficientRoundingZeroThreshold: Small coefficients are rounded to zero
     *   to reduce model complexity and prevent overfitting
     */
    training: {
      coefficientRoundingZeroThreshold: 1e-6,
    },
    /**
     * Model evaluation settings.
     *
     * Configures train/test split and minimum data requirements:
     * - trainRatio: 0.8 means 80% training, 20% testing
     * - minTrainExamples: Minimum examples needed for reliable model training
     * - enabled: Whether to perform evaluation during training
     */
    evaluation: {
      enabled: true,
      trainRatio: 0.8,
      minTrainExamples: 200,
    },
    /**
     * Production model version configuration.
     *
     * Determines which production version is used for real-time predictions.
     * Stored in database for runtime updates; this is the default value.
     */
    productionVersion: null as number | null,
  },
} as const;

/**
 * ## Functional Configuration Access
 *
 * Provides type-safe, functional access to configuration values.
 * These getter functions ensure consistent access patterns and
 * provide default values where appropriate.
 */

/**
 * Functional getters for common configuration access patterns.
 *
 * These functions provide a clean API for accessing configuration
 * while handling edge cases and providing sensible defaults.
 */
export const config = {
  // Terminal utilities
  isValidTerminal: (terminal: string) =>
    ML_CONFIG.terminals.valid.has(terminal),

  getTerminalAbbrev: (terminalName: string) =>
    ML_CONFIG.terminals.mapping[terminalName],

  getMeanAtDockDuration: (terminalPair: string) =>
    ML_CONFIG.terminals.meanAtDockDuration[terminalPair] || 0,

  getMeanAtSeaDuration: (terminalPair: string) =>
    ML_CONFIG.terminals.meanAtSeaDuration[terminalPair] || 0,

  // Threshold getters
  getMinAtSeaDuration: () => ML_CONFIG.thresholds.duration.atSea.min,

  getMaxAtSeaDuration: () => ML_CONFIG.thresholds.duration.atSea.max,

  getMinAtDockDuration: () => ML_CONFIG.thresholds.duration.atDock.min,

  getMaxAtDockDuration: () => ML_CONFIG.thresholds.duration.atDock.max,

  getMaxTotalDuration: () =>
    ML_CONFIG.thresholds.duration.arriveArriveTotal.max,

  // Pipeline getters
  /**
   * Get the number of days of historical data to use for training.
   * @returns Number of days back from today to include in training data
   */
  getDaysBack: () => ML_CONFIG.pipeline.dataLoading.daysBack,

  /**
   * Get the maximum number of records to fetch per vessel.
   * @returns Maximum records per vessel for memory management
   */
  getMaxRecordsPerVessel: () =>
    ML_CONFIG.pipeline.dataLoading.maxRecordsPerVessel,

  /**
   * Get the maximum number of training samples to keep per route.
   * @returns Maximum samples per route to prevent overfitting
   */
  getMaxSamplesPerRoute: () =>
    ML_CONFIG.pipeline.dataLoading.maxSamplesPerRoute,

  /**
   * Get the sampling strategy for reducing data volume.
   * @returns Sampling strategy (e.g., "recent_first")
   */
  getSamplingStrategy: () => ML_CONFIG.pipeline.dataLoading.samplingStrategy,

  /**
   * Get the threshold below which coefficients are rounded to zero.
   * @returns Coefficient rounding threshold for numerical stability
   */
  getCoefficientRoundingThreshold: () =>
    ML_CONFIG.pipeline.training.coefficientRoundingZeroThreshold,

  /**
   * Check if model evaluation is enabled.
   * @returns True if evaluation metrics should be computed
   */
  isEvaluationEnabled: () => ML_CONFIG.pipeline.evaluation.enabled,

  /**
   * Get the ratio of training data to total data for evaluation.
   * @returns Training data ratio (0.0 to 1.0)
   */
  getTrainRatio: () => ML_CONFIG.pipeline.evaluation.trainRatio,

  /**
   * Get the minimum number of training examples required.
   * @returns Minimum training examples for valid model training
   */
  getMinTrainExamples: () => ML_CONFIG.pipeline.evaluation.minTrainExamples,

  /**
   * Get the current production version number.
   * @returns Production version number or null if not set
   * @note This returns the default from config; actual runtime value is stored in database
   */
  getProductionVersion: () => ML_CONFIG.pipeline.productionVersion,
} as const;

/**
 * ## Terminal Pair Utilities
 *
 * Functions for working with terminal pair keys in "FROM->TO" format.
 * These utilities ensure consistent formatting and parsing across the codebase.
 */

/**
 * Format a terminal pair key from departing and arriving terminal codes.
 *
 * @param departing - Departure terminal abbreviation
 * @param arriving - Arrival terminal abbreviation
 * @returns Formatted pair key (e.g., "BBI->P52")
 */
export const formatTerminalPairKey = (
  departing: string,
  arriving: string
): string => `${departing}->${arriving}`;

/**
 * Parse a terminal pair key into departing and arriving terminals.
 *
 * @param key - Terminal pair key in "FROM->TO" format
 * @returns Tuple of [departing, arriving] terminal codes
 * @throws Error if key format is invalid
 */
export const parseTerminalPairKey = (key: string): [string, string] => {
  const parts = key.split("->");
  if (parts.length !== 2) {
    throw new Error(`Invalid terminal pair key format: ${key}`);
  }
  return [parts[0], parts[1]];
};
