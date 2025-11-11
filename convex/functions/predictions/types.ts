import { v } from "convex/values";

// ============================================================================
// FUNCTION-SPECIFIC PREDICTION TYPES (not database schemas)
// ============================================================================

/**
 * Type for prediction input arguments used in prediction functions
 * This bridges between vessel trip data and ML prediction input
 */
export const predictionFunctionInputSchema = {
  vesselId: v.number(),
  vesselName: v.string(),
  opRouteAbbrev: v.string(),
  depTermAbrv: v.string(),
  arvTermAbrv: v.string(),
  schedDep: v.number(),
  priorTime: v.number(),
  hourOfDay: v.number(),
  dayType: v.union(v.literal("weekday"), v.literal("weekend")),
  previousDelay: v.number(),
} as const;

/**
 * Type for prediction results from ML module
 * This matches what our ML module returns
 */
export const predictionResultSchema = {
  predictedTime: v.number(),
  confidence: v.number(),
  modelVersion: v.string(),
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PredictionFunctionInput = {
  vesselId: number;
  vesselName: string;
  opRouteAbbrev: string;
  depTermAbrv: string;
  arvTermAbrv: string;
  schedDep: number;
  priorTime: number;
  hourOfDay: number;
  dayType: "weekday" | "weekend";
  previousDelay: number;
};

export type PredictionResult = {
  predictedTime: number;
  confidence: number;
  modelVersion: string;
};
