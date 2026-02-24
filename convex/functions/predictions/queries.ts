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
 * Optionally filters by version tag.
 *
 * @param ctx - Convex context
 * @param args.pairKey - The terminal pair key (e.g., "TerminalA-TerminalB")
 * @param args.modelType - The model type to retrieve
 * @param args.versionTag - Optional version tag filter (e.g., "dev-temp", "dev-1", "prod-1")
 * @returns The model parameters record or null if not found
 */
export const getModelParametersByPair = query({
  args: {
    pairKey: v.string(),
    modelType: modelTypeValidator,
    versionTag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.versionTag !== undefined) {
      // Use version-specific index
      const versionTag = args.versionTag; // TypeScript now knows this is string
      return ctx.db
        .query("modelParameters")
        .withIndex("by_pair_type_tag", (q) =>
          q
            .eq("pairKey", args.pairKey)
            .eq("modelType", args.modelType)
            .eq("versionTag", versionTag)
        )
        .first();
    }
    // Fallback to pair+type index when no tag specified
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
 * Uses the active production version tag from config.
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
    // Get production version tag from config
    const config = await ctx.db
      .query("modelConfig")
      .withIndex("by_key", (q) => q.eq("key", "productionVersionTag"))
      .first();

    const prodVersionTag = config?.productionVersionTag;
    if (!prodVersionTag) {
      return null;
    }

    // Query with production version tag
    return ctx.db
      .query("modelParameters")
      .withIndex("by_pair_type_tag", (q) =>
        q
          .eq("pairKey", args.pairKey)
          .eq("modelType", args.modelType)
          .eq("versionTag", prodVersionTag)
      )
      .first();
  },
});

/**
 * Get model parameters for multiple model types in one query.
 * Uses the active production version tag from config.
 * Reduces Convex function calls when computing multiple predictions for a vessel.
 *
 * @param ctx - Convex context
 * @param args.pairKey - The terminal pair key (e.g., "BBI->P52")
 * @param args.modelTypes - Array of model types to retrieve
 * @returns Record mapping model type to model parameters (missing types omitted)
 */
export const getModelParametersForProductionBatch = query({
  args: {
    pairKey: v.string(),
    modelTypes: v.array(modelTypeValidator),
  },
  returns: v.record(v.string(), v.union(v.null(), v.any())),
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("modelConfig")
      .withIndex("by_key", (q) => q.eq("key", "productionVersionTag"))
      .first();

    const prodVersionTag = config?.productionVersionTag;
    if (!prodVersionTag) {
      return {} as Record<(typeof args.modelTypes)[number], unknown>;
    }

    const result: Record<string, unknown> = {};
    for (const modelType of args.modelTypes) {
      const doc = await ctx.db
        .query("modelParameters")
        .withIndex("by_pair_type_tag", (q) =>
          q
            .eq("pairKey", args.pairKey)
            .eq("modelType", modelType)
            .eq("versionTag", prodVersionTag)
        )
        .first();
      result[modelType] = doc ?? null;
    }
    return result as Record<(typeof args.modelTypes)[number], unknown>;
  },
});

/**
 * Get all models for a specific version tag.
 *
 * @param ctx - Convex context
 * @param args.versionTag - The version tag (e.g., "dev-temp", "dev-1", "prod-1")
 * @returns Array of model parameters for the specified version tag
 */
export const getModelParametersByTag = query({
  args: {
    versionTag: v.string(),
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("modelParameters")
      .withIndex("by_version_tag", (q) => q.eq("versionTag", args.versionTag))
      .collect(),
});

/**
 * Get all unique version tags.
 *
 * @param ctx - Convex context
 * @returns Array of unique version tags, sorted alphabetically
 */
export const getAllVersions = query({
  args: {},
  handler: async (ctx) => {
    const allModels = await ctx.db.query("modelParameters").collect();

    const versionTags = new Set<string>();

    for (const model of allModels) {
      versionTags.add(model.versionTag);
    }

    return Array.from(versionTags).sort();
  },
});

/**
 * Get the current production version tag from config.
 *
 * @param ctx - Convex context
 * @returns The production version tag or null if not set
 */
export const getProductionVersionTag = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db
      .query("modelConfig")
      .withIndex("by_key", (q) => q.eq("key", "productionVersionTag"))
      .first();

    return config?.productionVersionTag ?? null;
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
