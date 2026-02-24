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