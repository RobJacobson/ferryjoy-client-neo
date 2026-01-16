import { query } from "_generated/server";
import { v } from "convex/values";
import { modelTypeValidator, predictionTypeValidator } from "./schemas";

/**
 * Get all model parameters from the database
 *
 * @param ctx - Convex context
 * @returns Array of all model parameters records
 */
export const getAllModelParameters = query({
  args: {},
  handler: async (ctx) => ctx.db.query("modelParameters").collect(),
});

/**
 * Get model parameters for a specific terminal pair and model type.
 * Optionally filters by version type and number.
 *
 * @param ctx - Convex context
 * @param args.pairKey - The terminal pair key (e.g., "TerminalA-TerminalB")
 * @param args.modelType - The model type to retrieve
 * @param args.versionType - Optional version type filter ("dev" or "prod")
 * @param args.versionNumber - Optional version number filter
 * @returns The model parameters record or null if not found
 */
export const getModelParametersByPair = query({
  args: {
    pairKey: v.string(),
    modelType: modelTypeValidator,
    versionType: v.optional(v.union(v.literal("dev"), v.literal("prod"))),
    versionNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.versionType && args.versionNumber !== undefined) {
      // Use version-specific index
      const versionType = args.versionType; // TypeScript now knows this is "dev" | "prod"
      const versionNumber = args.versionNumber; // TypeScript now knows this is number
      return ctx.db
        .query("modelParameters")
        .withIndex("by_pair_type_version", (q) =>
          q
            .eq("pairKey", args.pairKey)
            .eq("modelType", args.modelType)
            .eq("versionType", versionType)
            .eq("versionNumber", versionNumber)
        )
        .first();
    }
    // Fallback to old index for backward compatibility
    return ctx.db
      .query("modelParameters")
      .withIndex("by_pair_and_type", (q) =>
        q.eq("pairKey", args.pairKey).eq("modelType", args.modelType)
      )
      .first();
  },
});

/**
 * Get model parameters for production predictions.
 * Uses the active production version from config.
 *
 * @param ctx - Convex context
 * @param args.pairKey - The terminal pair key (e.g., "TerminalA-TerminalB")
 * @param args.modelType - The model type to retrieve
 * @returns The model parameters record or null if not found
 */
export const getModelParametersForProduction = query({
  args: {
    pairKey: v.string(),
    modelType: modelTypeValidator,
  },
  handler: async (ctx, args) => {
    // Get production version from config
    const config = await ctx.db
      .query("mlConfig")
      .withIndex("by_key", (q) => q.eq("key", "productionVersion"))
      .first();

    const prodVersion = config?.productionVersion;
    if (prodVersion === null || prodVersion === undefined) {
      return null;
    }

    // Query with production version
    return ctx.db
      .query("modelParameters")
      .withIndex("by_pair_type_version", (q) =>
        q
          .eq("pairKey", args.pairKey)
          .eq("modelType", args.modelType)
          .eq("versionType", "prod")
          .eq("versionNumber", prodVersion)
      )
      .first();
  },
});

/**
 * Get all models for a specific version.
 *
 * @param ctx - Convex context
 * @param args.versionType - The version type ("dev" or "prod")
 * @param args.versionNumber - The version number
 * @returns Array of model parameters for the specified version
 */
export const getModelParametersByVersion = query({
  args: {
    versionType: v.union(v.literal("dev"), v.literal("prod")),
    versionNumber: v.number(),
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("modelParameters")
      .withIndex("by_version", (q) =>
        q
          .eq("versionType", args.versionType)
          .eq("versionNumber", args.versionNumber)
      )
      .collect(),
});

/**
 * Get all unique version numbers for dev and prod.
 *
 * @param ctx - Convex context
 * @returns Object with arrays of dev and prod version numbers
 */
export const getAllVersions = query({
  args: {},
  handler: async (ctx) => {
    const allModels = await ctx.db.query("modelParameters").collect();

    const devVersions = new Set<number>();
    const prodVersions = new Set<number>();

    for (const model of allModels) {
      if (model.versionType === "dev") {
        devVersions.add(model.versionNumber);
      } else if (model.versionType === "prod") {
        prodVersions.add(model.versionNumber);
      }
    }

    return {
      dev: Array.from(devVersions).sort((a, b) => a - b),
      prod: Array.from(prodVersions).sort((a, b) => a - b),
    };
  },
});

/**
 * Get the current production version from config.
 *
 * @param ctx - Convex context
 * @returns The production version number or null if not set
 */
export const getProductionVersion = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db
      .query("mlConfig")
      .withIndex("by_key", (q) => q.eq("key", "productionVersion"))
      .first();

    return config?.productionVersion ?? null;
  },
});

/**
 * Get all completed predictions for a specific vessel trip key.
 * Returns historical prediction performance data for analysis and monitoring.
 *
 * @param ctx - Convex query context
 * @param args.key - The vessel trip key to retrieve predictions for
 * @returns Array of prediction records for the specified trip key
 */
export const getPredictionsByKey = query({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("predictions")
      .withIndex("by_key", (q) => q.eq("Key", args.key))
      .collect(),
});

/**
 * Get all completed predictions for a specific vessel across all its trips.
 * Used for vessel-specific performance analysis and prediction accuracy monitoring.
 * @param ctx - Convex query context
 * @param args.vesselAbbreviation - The vessel abbreviation (e.g., "SPU") to retrieve predictions for
 * @returns Array of prediction records for the specified vessel
 */
export const getPredictionsByVessel = query({
  args: {
    vesselAbbreviation: v.string(),
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("predictions")
      .withIndex("by_vessel_abbreviation", (q) =>
        q.eq("VesselAbbreviation", args.vesselAbbreviation)
      )
      .collect(),
});

/**
 * Get all completed predictions for a specific prediction model type across all vessels and routes.
 * Used for model performance analysis and identifying prediction patterns by type.
 * @param ctx - Convex query context
 * @param args.predictionType - The PascalCase prediction type (e.g., "AtDockDepartCurr", "AtSeaArriveNext")
 * @returns Array of prediction records for the specified prediction type
 */
export const getPredictionsByType = query({
  args: {
    predictionType: predictionTypeValidator,
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("predictions")
      .withIndex("by_prediction_type", (q) =>
        q.eq("PredictionType", args.predictionType)
      )
      .collect(),
});

/**
 * Get all completed predictions for a specific vessel and prediction type combination.
 * Used for detailed vessel-specific model performance analysis.
 * @param ctx - Convex query context
 * @param args.vesselAbbreviation - The vessel abbreviation (e.g., "SPU") to filter by
 * @param args.predictionType - The PascalCase prediction type (e.g., "AtDockDepartCurr", "AtSeaArriveNext") to filter by
 * @returns Array of prediction records for the specified vessel and prediction type
 */
export const getPredictionsByVesselAndType = query({
  args: {
    vesselAbbreviation: v.string(),
    predictionType: predictionTypeValidator,
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("predictions")
      .withIndex("by_vessel_and_type", (q) =>
        q
          .eq("VesselAbbreviation", args.vesselAbbreviation)
          .eq("PredictionType", args.predictionType)
      )
      .collect(),
});

/**
 * Get all completed predictions within a specific time range based on predicted time.
 * Used for temporal analysis of prediction performance and historical trend analysis.
 * @param ctx - Convex query context
 * @param args.startTime - Start of time range in epoch milliseconds (inclusive)
 * @param args.endTime - End of time range in epoch milliseconds (inclusive)
 * @returns Array of prediction records with PredTime within the specified range
 */
export const getPredictionsByDateRange = query({
  args: {
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("predictions")
      .withIndex("by_pred_time", (q) =>
        q.gte("PredTime", args.startTime).lte("PredTime", args.endTime)
      )
      .collect(),
});
