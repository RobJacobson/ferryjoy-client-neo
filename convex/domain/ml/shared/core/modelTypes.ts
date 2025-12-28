// ============================================================================
// MODEL TYPE CONSTANTS
// Unified model type system to eliminate scattered string literals
// ============================================================================

/**
 * All available ML model types as constants
 */
export const MODEL_TYPES = {
  ARRIVE_DEPART_ATDOCK_DURATION: "arrive-depart-atdock-duration",
  DEPART_ARRIVE_ATSEA_DURATION: "depart-arrive-atsea-duration",
  ARRIVE_ARRIVE_TOTAL_DURATION: "arrive-arrive-total-duration",
  DEPART_DEPART_TOTAL_DURATION: "depart-depart-total-duration",
  ARRIVE_DEPART_DELAY: "arrive-depart-delay",
} as const;

/**
 * Type-safe model type - use this instead of string literals
 */
export type ModelType = (typeof MODEL_TYPES)[keyof typeof MODEL_TYPES];

/**
 * Helper function to check if a string is a valid model type
 */
export const isValidModelType = (type: string): type is ModelType => {
  return Object.values(MODEL_TYPES).includes(type as ModelType);
};

/**
 * Get all model types as an array
 */
export const ALL_MODEL_TYPES = Object.values(MODEL_TYPES);
