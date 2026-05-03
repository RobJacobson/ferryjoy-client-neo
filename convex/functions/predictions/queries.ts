/**
 * Queries over `modelParameters` and the active production tag from `keyValueStore`.
 * Public queries support ML tooling and audits; `getPredictionModelParameters` is
 * internal and supplies coefficients to the vessel orchestrator prediction pipeline.
 */

import type { QueryCtx } from "_generated/server";
import { internalQuery, query } from "_generated/server";
import { v } from "convex/values";
import { getProductionVersionTagValue } from "functions/keyValueStore/helpers";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import {
  type ModelType,
  modelParametersSchema,
  modelTypeValidator,
} from "./schemas";

/**
 * Returns every `modelParameters` row without Convex document metadata.
 *
 * Full table scan, suited to admin lists and audits, not hot-path prediction loads.
 *
 * @param ctx - Convex query context
 * @returns Rows shaped like `modelParametersSchema` without `_id` or `_creationTime`
 */
export const getAllModelParameters = query({
  args: {},
  returns: v.array(modelParametersSchema),
  handler: async (ctx) => {
    const results = await ctx.db.query("modelParameters").collect();
    return results.map(stripConvexMeta);
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
 * Loads one `modelParameters` row for a pair, model type, and training snapshot tag.
 *
 * Encapsulates the composite key prediction uses: the row is identified by `pairKey`,
 * `modelType`, and `versionTag` together, not by any one field alone.
 *
 * @param ctx - Convex query context
 * @param pairKey - Terminal pair identifier stored on each row
 * @param modelType - Which regression head (`MODEL_KEYS` / `modelTypeValidator`)
 * @param versionTag - Training snapshot label (typically the active production tag)
 * @returns Full row from `modelParameters`, or `null` when missing
 */
const loadModelParametersDocByPairTypeTag = async (
  ctx: QueryCtx,
  pairKey: string,
  modelType: ModelType,
  versionTag: string
) =>
  await ctx.db
    .query("modelParameters")
    .withIndex("by_pair_type_tag", (q) =>
      q
        .eq("pairKey", pairKey)
        .eq("modelType", modelType)
        .eq("versionTag", versionTag)
    )
    .first();

/**
 * Returns trimmed coefficients for orchestrator prediction (active production tag).
 *
 * Resolves `productionVersionTag` once, dedupes requested `modelTypes`, then loads each
 * `(pairKey, modelType, tag)` row. Maps to domain expectations: nested structure
 * `pairKey → modelType → { featureKeys, coefficients, intercept, testMetrics }`
 * with only MAE and stdDev under `testMetrics` for the narrow inference surface.
 *
 * @param ctx - Convex internal query context
 * @param args.request - When omitted or when production tag is unset, returns `{}`;
 *   otherwise `{ pairKey, modelTypes }` selects which heads to load for that pair
 * @returns Nested map keyed by pair then model type; missing heads map to `null`
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
        const doc = await loadModelParametersDocByPairTypeTag(
          ctx,
          pairKey,
          modelType,
          prodVersionTag
        );

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
 * Returns every `modelParameters` row for one training snapshot tag.
 *
 * Indexed read by tag—intended when diffing or promoting a named snapshot (for example
 * before rename/delete mutations), not for unfiltered scans.
 *
 * @param ctx - Convex query context
 * @param args.versionTag - Tag whose rows are returned (for example `dev-temp`, `prod-1`)
 * @returns Rows matching `modelParametersSchema` without `_id` or `_creationTime`
 */
export const getModelParametersByTag = query({
  args: {
    versionTag: v.string(),
  },
  returns: v.array(modelParametersSchema),
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("modelParameters")
      .withIndex("by_version_tag", (q) => q.eq("versionTag", args.versionTag))
      .collect();
    return results.map(stripConvexMeta);
  },
});

/**
 * Returns sorted distinct `versionTag` strings currently stored in `modelParameters`.
 *
 * Builds the set via a full table scan—acceptable for small cardinality ML admin flows,
 * not for prediction hot paths.
 *
 * @param ctx - Convex query context
 * @returns Lexicographically sorted unique tags
 */
export const getAllVersions = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const allModels = await ctx.db.query("modelParameters").collect();

    const versionTags = new Set<string>();

    for (const model of allModels) {
      versionTags.add(model.versionTag);
    }

    return Array.from(versionTags).sort();
  },
});

export { getProductionVersionTag } from "../keyValueStore/queries";
