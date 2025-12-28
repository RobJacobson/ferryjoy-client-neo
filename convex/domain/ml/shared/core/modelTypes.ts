// ============================================================================
// MODEL TYPE CONSTANTS
// Unified model type system to eliminate scattered string literals
// ============================================================================

/**
 * All available ML model types as constants
 *
 * Each model type corresponds to a different prediction scenario:
 * - ARRIVE_DEPART_*: Predictions made when vessel arrives at terminal
 * - DEPART_ARRIVE_*: Predictions made when vessel departs from terminal
 * - ARRIVE_ARRIVE_*: End-to-end predictions from arrival to next arrival
 * - DEPART_DEPART_*: Predictions between consecutive departures
 */
export const MODEL_TYPES = {
  /** Predict at-dock duration after vessel arrives at terminal */
  ARRIVE_DEPART_ATDOCK_DURATION: "arrive-depart-atdock-duration",
  /** Predict at-sea duration after vessel departs from terminal */
  DEPART_ARRIVE_ATSEA_DURATION: "depart-arrive-atsea-duration",
  /** Predict total trip duration from arrival to next arrival */
  ARRIVE_ARRIVE_TOTAL_DURATION: "arrive-arrive-total-duration",
  /** Predict time between consecutive departures (depart-depart cycle) */
  DEPART_DEPART_TOTAL_DURATION: "depart-depart-total-duration",
  /** Predict departure delay after vessel arrives at terminal */
  ARRIVE_DEPART_DELAY: "arrive-depart-delay",
} as const;

/**
 * Type-safe model type - use this instead of string literals
 */
export type ModelType = (typeof MODEL_TYPES)[keyof typeof MODEL_TYPES];

/**
 * Type guard to check if a string is a valid model type
 * @param type - String to validate as model type
 * @returns True if the string is a valid ModelType
 */
export const isValidModelType = (type: string): type is ModelType => {
  return Object.values(MODEL_TYPES).includes(type as ModelType);
};

/**
 * Array of all available model types for iteration
 */
export const ALL_MODEL_TYPES = Object.values(MODEL_TYPES);
