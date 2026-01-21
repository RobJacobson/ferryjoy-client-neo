// ============================================================================
// SHARED UTILITIES MODULE
// Core types, configuration, and utilities shared across ML modules
// ============================================================================

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
 * WSF vessel history normalization (missing fields inference)
 */
export * from "./normalizeWsfVesselHistories";

/**
 * Unified trip structure for ML training and prediction
 */
export * from "./unifiedTrip";
