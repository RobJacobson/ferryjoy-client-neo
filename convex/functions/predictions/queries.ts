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
 * Lists every stored `modelParameters` row (training metadata stripped).
 *
 * Full table scan suitable for admin UIs and audits; not indexed by pair or tag.
 *
 * @param ctx - Convex query context
 * @returns All model parameter docs without `_id` / `_creationTime`
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
 * Loads one production model row for a terminal pair and model type.
 *
 * Resolves the active `versionTag` from `keyValueStore`, then reads
 * `by_pair_type_tag`; returns `null` when no production tag is configured or
 * no row matches.
 *
 * @param ctx - Convex query context
 * @param args - Query arguments containing the pair key and model type
 * @returns The model parameters record or `null` if not found
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
 * Batch-loads production model rows for several `modelTypes` on one `pairKey`.
 *
 * Uses the active production `versionTag` once, then issues one indexed read per
 * type so orchestrator prediction stages avoid N separate client round-trips.
 *
 * @param ctx - Convex query context
 * @param args - Pair key and requested model types (deduped in the handler)
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
 * Loads trimmed coefficient payloads for one `pairKey` and requested `modelTypes`
 * under the active production `versionTag` (or empty when tag/config missing).
 *
 * Shape matches domain `loadPredictionModelParameters` expectations: nested map
 * `pairKey → modelType → { featureKeys, coefficients, intercept, testMetrics }`.
 *
 * @param ctx - Convex internal query context
 * @param args.request - Optional `{ pairKey, modelTypes }`; empty request yields `{}`
 * @returns Record keyed by pair, then by model type, with nulls for missing rows
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
 * Lists all `modelParameters` rows for one `versionTag` (metadata stripped).
 *
 * Uses `by_version_tag` for efficient retrieval when comparing or promoting a
 * specific training snapshot.
 *
 * @param ctx - Convex query context
 * @param args - Version tag to filter
 * @returns Matching docs without `_id` / `_creationTime`
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
 * Returns distinct `versionTag` values present in `modelParameters`, sorted.
 *
 * Scans all model rows to build the set; suitable for low-cardinality admin lists,
 * not hot-path prediction reads.
 *
 * @param ctx - Convex query context
 * @returns Sorted unique version tags
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
