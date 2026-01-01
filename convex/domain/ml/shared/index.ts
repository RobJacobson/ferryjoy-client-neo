// ============================================================================
// SHARED MODULE EXPORTS
// Shared utilities used across training and prediction phases
// ============================================================================

/**
 * Core prediction utilities used by training pipeline for metrics calculation
 */
export * from "../prediction";
/**
 * Core ML types, configuration constants, and model type definitions
 */
export * from "./config";

/**
 * Feature extraction utilities
 */
export * from "./features";

/**
 * Central model definitions and registry
 */
export * from "./models";
export * from "./types";

/**
 * Unified trip structure for ML training and prediction
 */
export * from "./unifiedTrip";
