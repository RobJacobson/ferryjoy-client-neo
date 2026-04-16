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
 * Store trained ML model parameters in the database.
 * For "dev-temp" versions, deletes existing "dev-temp" for the same bucket+type.
 * Other versions are preserved (versioning system handles multiple versions).
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
 * Delete a specific model parameters record from the database
 *
 * @param ctx - Convex mutation context
 * @param args - Mutation arguments containing the model document id
 * @returns Success confirmation object
 */
export const deleteModelParametersMutation = mutation({
  args: { modelId: v.id("modelParameters") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.modelId);
    return { success: true };
  },
});

/**
 * Delete all model parameters records from the database
 *
 * @param ctx - Convex mutation context
 * @returns Object with the number of records deleted
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
 * Copy all models from one version tag to another.
 * Optionally deletes the source models (useful for dev-temp promotion).
 *
 * @param ctx - Convex mutation context
 * @param args - Mutation arguments containing source and destination version tags
 * @returns Object with count of models copied
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
 * Rename a version tag by copying all models to a new tag and deleting the old tag.
 *
 * @param ctx - Convex mutation context
 * @param args - Mutation arguments containing source and destination version tags
 * @returns Object with count of models renamed
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
 * Delete all models for a specific version tag.
 *
 * @param ctx - Convex mutation context
 * @param args - Mutation arguments containing the version tag to delete
 * @returns Object with count of models deleted
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
 * Set the active production version tag for predictions.
 *
 * @param ctx - Convex mutation context
 * @param args - Mutation arguments containing the production version tag
 * @returns Success confirmation
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
 * Get model configuration (internal helper).
 *
 * @param ctx - Convex mutation context
 * @returns Model config with production version tag (null when unset)
 */
async function getModelConfig(ctx: MutationCtx): Promise<{
  productionVersionTag: string | null;
}> {
  const productionVersionTag = await getProductionVersionTagValue(ctx);
  return { productionVersionTag };
}
