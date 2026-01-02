import type { Infer } from "convex/values";
import { v } from "convex/values";

/**
 * Convex validator for model parameters mutation argument (numbers)
 */
export const modelParametersMutationSchema = v.object({
  departingTerminalAbbrev: v.string(),
  arrivingTerminalAbbrev: v.string(),
  modelType: v.union(
    v.literal("arrive-depart-atdock-duration"),
    v.literal("arrive-depart-delay"),
    v.literal("depart-arrive-atsea-duration"),
    v.literal("arrive-arrive-total-duration"),
    v.literal("depart-depart-total-duration")
  ),

  // Model parameters (optional for insufficient data cases)
  coefficients: v.optional(v.array(v.number())),
  intercept: v.optional(v.number()),
  testMetrics: v.optional(
    v.object({
      mae: v.number(),
      rmse: v.number(),
      r2: v.number(),
      stdDev: v.optional(v.number()),
    })
  ),

  // Legacy field - kept for backward compatibility during migration
  trainingMetrics: v.optional(
    v.object({
      mae: v.number(),
      rmse: v.number(),
      r2: v.number(),
      stdDev: v.optional(v.number()),
    })
  ),

  // Required metadata
  createdAt: v.number(),

  // Bucket statistics (optional for backward compatibility)
  bucketStats: v.optional(
    v.object({
      totalRecords: v.number(),
      filteredRecords: v.number(),
      meanDepartureDelay: v.optional(v.number()),
      meanAtSeaDuration: v.optional(v.number()),
      meanDelay: v.optional(v.number()),
      // Backward compatibility for old data
      meanAtDockDuration: v.optional(v.number()),
    })
  ),
});

/**
 * Type for model parameters in Convex storage (with numbers)
 * Inferred from the Convex validator
 */
export type ConvexModelParameters = Infer<typeof modelParametersMutationSchema>;
