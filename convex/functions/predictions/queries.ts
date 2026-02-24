import { query } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import {
  type ConvexModelParameters,
  modelParametersSchema,
  modelTypeValidator,
} from "./schemas";

/**
 * Get all model parameters from the database
 *
 * @param ctx - Convex context
 * @returns Array of all model parameters records without metadata
 */
export const getAllModelParameters = query({
  args: {},
  returns: v.array(modelParametersSchema),
  handler: async (ctx) => {
    try {
      const results = await ctx.db.query("modelParameters").collect();
      return results.map(stripConvexMeta);
    } catch (error) {
      throw new ConvexError({
        message: "Failed to fetch all model parameters",
        code: "QUERY_FAILED",
        severity: "error",
        details: { error: String(error) },
      });
    }
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
  returns: v.union(modelParametersSchema, v.null()),
  handler: async (ctx, args) => {
    try {
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
      const doc = await ctx.db
        .query("modelParameters")
        .withIndex("by_pair_type_tag", (q) =>
          q
            .eq("pairKey", args.pairKey)
            .eq("modelType", args.modelType)
            .eq("versionTag", prodVersionTag)
        )
        .first();

      return doc ? stripConvexMeta(doc) : null;
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch production model parameters for pair ${args.pairKey} and model type ${args.modelType}`,
        code: "QUERY_FAILED",
        severity: "error",
        details: {
          pairKey: args.pairKey,
          modelType: args.modelType,
          error: String(error),
        },
      });
    }
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
 * @returns Record mapping ModelType to model parameters.
 *          Each value is either a ModelDoc without Convex metadata (_id, _creationTime)
 *          or null if not found for that model type.
 *
 *          The return is an object with optional fields for each model type:
 *          {
 *            "at-dock-depart-curr"?: ModelDoc | null,
 *            "at-dock-arrive-next"?: ModelDoc | null,
 *            "at-dock-depart-next"?: ModelDoc | null,
 *            "at-sea-arrive-next"?: ModelDoc | null,
 *            "at-sea-depart-next"?: ModelDoc | null,
 *          }
 */
export const getModelParametersForProductionBatch = query({
  args: {
    pairKey: v.string(),
    modelTypes: v.array(modelTypeValidator),
  },
  returns: v.record(v.string(), v.union(modelParametersSchema, v.null())),
  handler: async (ctx, args) => {
    try {
      const config = await ctx.db
        .query("modelConfig")
        .withIndex("by_key", (q) => q.eq("key", "productionVersionTag"))
        .first();

      const prodVersionTag = config?.productionVersionTag;
      if (!prodVersionTag) {
        return {};
      }

      const result: Record<string, ConvexModelParameters | null> = {};
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
        result[modelType] = doc ? stripConvexMeta(doc) : null;
      }
      return result;
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch batch production model parameters for pair ${args.pairKey}`,
        code: "QUERY_FAILED",
        severity: "error",
        details: {
          pairKey: args.pairKey,
          modelTypes: args.modelTypes,
          modelTypeCount: args.modelTypes.length,
          error: String(error),
        },
      });
    }
  },
});

/**
 * Get all models for a specific version tag.
 *
 * @param ctx - Convex context
 * @param args.versionTag - The version tag (e.g., "dev-temp", "dev-1", "prod-1")
 * @returns Array of model parameters for the specified version tag without metadata
 */
export const getModelParametersByTag = query({
  args: {
    versionTag: v.string(),
  },
  returns: v.array(modelParametersSchema),
  handler: async (ctx, args) => {
    try {
      const results = await ctx.db
        .query("modelParameters")
        .withIndex("by_version_tag", (q) => q.eq("versionTag", args.versionTag))
        .collect();
      return results.map(stripConvexMeta);
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch model parameters for version tag ${args.versionTag}`,
        code: "QUERY_FAILED",
        severity: "error",
        details: { versionTag: args.versionTag, error: String(error) },
      });
    }
  },
});

/**
 * Get all unique version tags.
 *
 * @param ctx - Convex context
 * @returns Array of unique version tags, sorted alphabetically
 */
export const getAllVersions = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    try {
      const allModels = await ctx.db.query("modelParameters").collect();

      const versionTags = new Set<string>();

      for (const model of allModels) {
        versionTags.add(model.versionTag);
      }

      return Array.from(versionTags).sort();
    } catch (error) {
      throw new ConvexError({
        message: "Failed to fetch all unique version tags",
        code: "QUERY_FAILED",
        severity: "error",
        details: { error: String(error) },
      });
    }
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
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    try {
      const config = await ctx.db
        .query("modelConfig")
        .withIndex("by_key", (q) => q.eq("key", "productionVersionTag"))
        .first();

      return config?.productionVersionTag ?? null;
    } catch (error) {
      throw new ConvexError({
        message: "Failed to fetch production version tag from config",
        code: "QUERY_FAILED",
        severity: "error",
        details: { configKey: "productionVersionTag", error: String(error) },
      });
    }
  },
});
