import { zodToConvex } from "convex-helpers/server/zod";
import { z } from "zod";

import {
  epochMillisToDate,
  optionalEpochMillisToDate,
} from "../../shared/codecs";

/**
 * Zod schema for current prediction data (domain representation with Date objects)
 * Single table with type discriminator
 */
const currentPredictionDataZodSchema = z.object({
  vesselId: z.number(),
  predictionType: z.union([z.literal("departure"), z.literal("arrival")]),
  vesselName: z.string(),
  opRouteAbrv: z.string(),
  depTermAbrv: z.string(),
  arvTermAbrv: z.string(),
  createdAt: epochMillisToDate, // Date in domain, number in Convex
  schedDep: epochMillisToDate, // Date in domain, number in Convex
  predictedTime: epochMillisToDate, // Date in domain, number in Convex
  confidence: z.number(),
  modelVersion: z.string(),
});

/**
 * Convex validator for current prediction data
 * Exported as currentPredictionDataSchema for backward compatibility
 */
export const currentPredictionDataSchema = zodToConvex(
  currentPredictionDataZodSchema
);

/**
 * Zod schema for historical predictions analysis (domain representation with Date objects)
 */
const historicalPredictionDataZodSchema = z.object({
  vesselId: z.number(),
  predictionType: z.union([z.literal("departure"), z.literal("arrival")]),
  vesselName: z.string(),
  opRouteAbrv: z.string(),
  depTermAbrv: z.string(),
  arvTermAbrv: z.string(),
  modelVersion: z.string(),
  createdAt: epochMillisToDate, // Date in domain, number in Convex
  schedDep: epochMillisToDate, // Date in domain, number in Convex
  predictedTime: epochMillisToDate, // Date in domain, number in Convex
  confidence: z.number(),
  predictionId: z.string(),
  predictionTimestamp: epochMillisToDate, // Date in domain, number in Convex
  hourOfDay: z.number(),
  dayType: z.union([z.literal("weekday"), z.literal("weekend")]),
  previousDelay: z.number(),
  priorTime: epochMillisToDate, // Date in domain, number in Convex
  actual: optionalEpochMillisToDate, // Date in domain, number in Convex
  error: z.number().optional(),
});

/**
 * Convex validator for historical prediction data
 * Exported as historicalPredictionDataSchema for backward compatibility
 */
export const historicalPredictionDataSchema = zodToConvex(
  historicalPredictionDataZodSchema
);

/**
 * Zod schema for model parameters mutation argument (domain representation with Date objects)
 */
const modelParametersMutationZodSchema = z.object({
  routeId: z.string(),
  modelType: z.union([z.literal("departure"), z.literal("arrival")]),
  modelAlgorithm: z.string().optional(),
  coefficients: z.array(z.number()),
  intercept: z.number(),
  featureNames: z.array(z.string()),
  trainingMetrics: z.object({
    mae: z.number(),
    rmse: z.number(),
    r2: z.number(),
    stdDev: z.number().optional(),
  }),
  modelVersion: z.string(),
  createdAt: epochMillisToDate, // Date in domain, number in Convex
});

/**
 * Convex validator for model parameters
 * Exported as modelParametersMutationSchema for backward compatibility
 */
export const modelParametersMutationSchema = zodToConvex(
  modelParametersMutationZodSchema
);

// Export types for use in domain layer (with Date objects)
// Inferred from the Zod schemas
export type CurrentPredictionData = z.infer<
  typeof currentPredictionDataZodSchema
>;
export type HistoricalPredictionData = z.infer<
  typeof historicalPredictionDataZodSchema
>;
export type ModelParameters = z.infer<typeof modelParametersMutationZodSchema>;

// Export Convex types (with numbers)
// Uses z.input to get the input type of the codec (numbers), not the output type (Dates)
export type ConvexCurrentPredictionData = z.input<
  typeof currentPredictionDataZodSchema
>;
export type ConvexHistoricalPredictionData = z.input<
  typeof historicalPredictionDataZodSchema
>;
export type ConvexModelParameters = z.input<
  typeof modelParametersMutationZodSchema
>;
