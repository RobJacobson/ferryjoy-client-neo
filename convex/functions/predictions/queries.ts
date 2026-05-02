/**
 * Query handlers for stored ML model parameters and active version tags.
 */

import { internalQuery, query } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { getProductionVersionTagValue } from "functions/keyValueStore/helpers";
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
 * @param ctx - Convex query context
 * @param args - Query arguments containing the pair key and model type
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
      const prodVersionTag = await getProductionVersionTagValue(ctx);
      if (!prodVersionTag) {
        return null;
      }

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
 * @param ctx - Convex query context
 * @param args - Query arguments containing the pair key and requested model types
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
      const prodVersionTag = await getProductionVersionTagValue(ctx);
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

const productionModelParametersSchema = v.object({
  featureKeys: v.array(v.string()),
  coefficients: v.array(v.number()),
  intercept: v.number(),
  testMetrics: v.object({
    mae: v.number(),
    stdDev: v.number(),
  }),
});

/**
 * Loads prediction model parameter docs for one terminal pair (active production
 * version tag) and returns a plain lookup keyed by pair and model type.
 */
export const getPredictionModelParameters = internalQuery({
  args: {
    request: v.optional(
      v.object({
        pairKey: v.string(),
        modelTypes: v.array(modelTypeValidator),
      })
    ),
  },
  returns: v.record(
    v.string(),
    v.record(v.string(), v.union(productionModelParametersSchema, v.null()))
  ),
  handler: async (ctx, args) => {
    const prodVersionTag = await getProductionVersionTagValue(ctx);
    if (!prodVersionTag || args.request === undefined) {
      return {};
    }

    const { pairKey, modelTypes: rawModelTypes } = args.request;
    const modelTypes = [...new Set(rawModelTypes)];

    const models = await Promise.all(
      modelTypes.map(async (modelType) => {
        const doc = await ctx.db
          .query("modelParameters")
          .withIndex("by_pair_type_tag", (q) =>
            q
              .eq("pairKey", pairKey)
              .eq("modelType", modelType)
              .eq("versionTag", prodVersionTag)
          )
          .first();

        return [
          modelType,
          doc === null
            ? null
            : {
                featureKeys: doc.featureKeys,
                coefficients: doc.coefficients,
                intercept: doc.intercept,
                testMetrics: {
                  mae: doc.testMetrics.mae,
                  stdDev: doc.testMetrics.stdDev,
                },
              },
        ] as const;
      })
    );

    return { [pairKey]: Object.fromEntries(models) };
  },
});

/**
 * Get all models for a specific version tag.
 *
 * @param ctx - Convex query context
 * @param args - Query arguments containing the version tag
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

export { getProductionVersionTag } from "../keyValueStore/queries";
