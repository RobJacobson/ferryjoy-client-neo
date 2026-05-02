/**
 * Mutation handlers for model parameter storage and version-tag lifecycle.
 */

import type { MutationCtx } from "_generated/server";
import { mutation } from "_generated/server";
import { v } from "convex/values";
import {
  getProductionVersionTagValue,
  upsertByKey,
} from "functions/keyValueStore/helpers";
import { KEY_PRODUCTION_VERSION_TAG } from "functions/keyValueStore/schemas";
import { modelParametersSchema } from "functions/predictions/schemas";

/**
 * Persists one trained `modelParameters` document.
 *
 * Replaces prior `dev-temp` rows for the same pair and `modelType` so ephemeral
 * training runs do not accumulate; other `versionTag` values append as history.
 *
 * @param ctx - Convex mutation context
 * @param args - Mutation arguments containing the model parameters to store
 * @returns The ID of the inserted model parameters document
 */
export const storeModelParametersMutation = mutation({
  args: {
    model: modelParametersSchema,
  },
  handler: async (ctx, args) => {
    const { bucketType, pairKey, modelType, versionTag } = args.model;

    // Keep only one ephemeral training snapshot per pair and model type.
    if (bucketType === "pair" && pairKey && versionTag === "dev-temp") {
      const existing = await ctx.db
        .query("modelParameters")
        .withIndex("by_pair_type_tag", (q) =>
          q
            .eq("pairKey", pairKey)
            .eq("modelType", modelType)
            .eq("versionTag", "dev-temp")
        )
        .collect();
      for (const doc of existing) {
        await ctx.db.delete(doc._id);
      }
    }

    return await ctx.db.insert("modelParameters", args.model);
  },
});

/**
 * Deletes one `modelParameters` row by document id.
 *
 * Used by training tooling to drop a single bad snapshot without touching other
 * version tags or pairs.
 *
 * @param ctx - Convex mutation context
 * @param args - Mutation arguments containing the model document id
 * @returns `{ success: true }` after deletion
 */
export const deleteModelParametersMutation = mutation({
  args: { modelId: v.id("modelParameters") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.modelId);
    return { success: true };
  },
});

/**
 * Deletes every row in `modelParameters` (destructive; for dev or reset tooling).
 *
 * Scans the full table; intended only for controlled environments where wiping
 * all trained models is acceptable.
 *
 * @param ctx - Convex mutation context
 * @returns `{ deleted: count }` for the removed documents
 */
export const deleteAllModelParametersMutation = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("modelParameters").collect();
    for (const doc of all) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: all.length };
  },
});

/**
 * Clones every `modelParameters` row from `fromTag` to `toTag` by insert.
 *
 * Optionally removes source rows after copy (e.g. promote `dev-temp` without duplicates).
 *
 * @param ctx - Convex mutation context
 * @param args - Source and destination version tags and optional source deletion
 * @returns `{ copied: number }` for rows inserted under `toTag`
 */
export const copyVersionTag = mutation({
  args: {
    fromTag: v.string(),
    toTag: v.string(),
    deleteSource: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const deleteSource = args.deleteSource ?? false;

    const sourceModels = await ctx.db
      .query("modelParameters")
      .withIndex("by_version_tag", (q) => q.eq("versionTag", args.fromTag))
      .collect();

    if (sourceModels.length === 0) {
      throw new Error(`No models found with version tag "${args.fromTag}"`);
    }

    // Reinsert under the destination tag so model history stays append-only.
    const copiedIds: string[] = [];
    for (const model of sourceModels) {
      const { _id, _creationTime, ...modelData } = model;
      const newModel = {
        ...modelData,
        versionTag: args.toTag,
      };
      const newId = await ctx.db.insert("modelParameters", newModel);
      copiedIds.push(newId);

      if (deleteSource) {
        await ctx.db.delete(_id);
      }
    }

    return { copied: copiedIds.length };
  },
});

/**
 * Moves all rows from `fromTag` to `toTag` (insert + delete each source row).
 *
 * Refuses when `fromTag` is the active production tag so live reads stay valid.
 *
 * @param ctx - Convex mutation context
 * @param args - Source and destination version tags
 * @returns `{ renamed: number }` for rows moved
 */
export const renameVersionTag = mutation({
  args: {
    fromTag: v.string(),
    toTag: v.string(),
  },
  handler: async (ctx, args) => {
    // Guard the active production tag so reads never point at a missing version.
    const config = await getModelConfig(ctx);
    if (config?.productionVersionTag === args.fromTag) {
      throw new Error(
        `Cannot rename active production version tag "${args.fromTag}". Switch to a different version first.`
      );
    }

    const sourceModels = await ctx.db
      .query("modelParameters")
      .withIndex("by_version_tag", (q) => q.eq("versionTag", args.fromTag))
      .collect();

    if (sourceModels.length === 0) {
      throw new Error(`No models found with version tag "${args.fromTag}"`);
    }

    const renamedIds: string[] = [];
    for (const model of sourceModels) {
      const { _id, _creationTime, ...modelData } = model;
      const newModel = {
        ...modelData,
        versionTag: args.toTag,
      };
      const newId = await ctx.db.insert("modelParameters", newModel);
      renamedIds.push(newId);
      await ctx.db.delete(_id);
    }

    return { renamed: renamedIds.length };
  },
});

/**
 * Deletes every `modelParameters` row for one `versionTag`.
 *
 * Refuses when that tag is production-active so prediction queries keep a backing row set.
 *
 * @param ctx - Convex mutation context
 * @param args - Version tag to wipe
 * @returns `{ deleted: number }` for removed rows
 */
export const deleteVersion = mutation({
  args: {
    versionTag: v.string(),
  },
  handler: async (ctx, args) => {
    // Guard the active production tag so prediction reads remain valid.
    const config = await getModelConfig(ctx);
    if (config?.productionVersionTag === args.versionTag) {
      throw new Error(
        `Cannot delete active production version tag "${args.versionTag}". Switch to a different version first.`
      );
    }

    const models = await ctx.db
      .query("modelParameters")
      .withIndex("by_version_tag", (q) => q.eq("versionTag", args.versionTag))
      .collect();

    for (const model of models) {
      await ctx.db.delete(model._id);
    }

    return { deleted: models.length };
  },
});

/**
 * Writes the production version tag to `keyValueStore` after verifying at least
 * one `modelParameters` row exists for that tag.
 *
 * @param ctx - Convex mutation context
 * @param args - Production version tag to activate
 * @returns `{ success: true }` after the config row is updated
 */
export const setProductionVersionTag = mutation({
  args: {
    versionTag: v.string(),
  },
  handler: async (ctx, args) => {
    // Activate only version tags that already have stored model rows.
    const models = await ctx.db
      .query("modelParameters")
      .withIndex("by_version_tag", (q) => q.eq("versionTag", args.versionTag))
      .first();

    if (!models) {
      throw new Error(
        `Production version tag "${args.versionTag}" does not exist. Create it first by copying a dev version.`
      );
    }

    await upsertByKey(ctx, KEY_PRODUCTION_VERSION_TAG, args.versionTag);

    return { success: true };
  },
});

/**
 * Reads the active production tag from `keyValueStore` for mutation guards.
 *
 * Centralizes the lookup so rename/delete/version mutations share the same rule:
 * never orphan the configured production tag.
 *
 * @param ctx - Convex mutation context
 * @returns Wrapper with `productionVersionTag` (string or null when unset)
 */
async function getModelConfig(ctx: MutationCtx): Promise<{
  productionVersionTag: string | null;
}> {
  const productionVersionTag = await getProductionVersionTagValue(ctx);
  return { productionVersionTag };
}
