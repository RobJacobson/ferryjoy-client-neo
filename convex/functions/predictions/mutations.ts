import type { MutationCtx } from "_generated/server";
import { mutation } from "_generated/server";
import { v } from "convex/values";
import {
  modelParametersSchema,
  predictionRecordSchema,
} from "functions/predictions/schemas";

/**
 * Store trained ML model parameters in the database.
 * For "dev-temp" versions, deletes existing "dev-temp" for the same bucket+type.
 * Other versions are preserved (versioning system handles multiple versions).
 *
 * @param ctx - Convex context
 * @param args.model - The model parameters to store
 * @returns The ID of the inserted model parameters document
 */
export const storeModelParametersMutation = mutation({
  args: {
    model: modelParametersSchema,
  },
  handler: async (ctx, args) => {
    const { bucketType, pairKey, modelType, versionTag } = args.model;

    // For dev-temp, delete any existing dev-temp for the same pair+type
    // This ensures only one dev-temp exists at a time
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
 * @param ctx - Convex context
 * @param args.modelId - The ID of the model parameters record to delete
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
 * @param ctx - Convex context
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
 * Insert a completed prediction record into the predictions table.
 * Handles deduplication by checking for existing predictions with the same Key + PredictionType.
 * Used to store completed predictions for performance monitoring and analysis.
 *
 * @param ctx - Convex mutation context
 * @param args.prediction - The prediction record to insert with all required fields
 * @returns The ID of the inserted prediction, or the existing prediction ID if duplicate found
 */
export const insertPrediction = mutation({
  args: {
    prediction: predictionRecordSchema,
  },
  handler: async (ctx, args) => {
    // Check for existing prediction with same Key + PredictionType
    const existing = await ctx.db
      .query("predictions")
      .withIndex("by_key", (q) => q.eq("Key", args.prediction.Key))
      .filter((q) =>
        q.eq(q.field("PredictionType"), args.prediction.PredictionType)
      )
      .first();

    if (existing) {
      // Prediction already exists, return existing ID
      return existing._id;
    }

    // Insert new prediction
    return await ctx.db.insert("predictions", args.prediction);
  },
});

/**
 * Copy all models from one version tag to another.
 * Optionally deletes the source models (useful for dev-temp promotion).
 *
 * @param ctx - Convex context
 * @param args.fromTag - The source version tag (e.g., "dev-temp", "dev-1")
 * @param args.toTag - The destination version tag (e.g., "dev-1", "prod-1")
 * @param args.deleteSource - Whether to delete source models after copying (default: false)
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

    // Find all models with the source tag
    const sourceModels = await ctx.db
      .query("modelParameters")
      .withIndex("by_version_tag", (q) => q.eq("versionTag", args.fromTag))
      .collect();

    if (sourceModels.length === 0) {
      throw new Error(`No models found with version tag "${args.fromTag}"`);
    }

    // Copy each model to the new tag
    const copiedIds: string[] = [];
    for (const model of sourceModels) {
      const { _id, _creationTime, ...modelData } = model;
      const newModel = {
        ...modelData,
        versionTag: args.toTag,
      };
      const newId = await ctx.db.insert("modelParameters", newModel);
      copiedIds.push(newId);

      // Delete source if requested
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
 * @param ctx - Convex context
 * @param args.fromTag - The source version tag to rename from
 * @param args.toTag - The destination version tag to rename to
 * @returns Object with count of models renamed
 */
export const renameVersionTag = mutation({
  args: {
    fromTag: v.string(),
    toTag: v.string(),
  },
  handler: async (ctx, args) => {
    // Prevent renaming the currently active production version
    const config = await getModelConfig(ctx);
    if (config?.productionVersionTag === args.fromTag) {
      throw new Error(
        `Cannot rename active production version tag "${args.fromTag}". Switch to a different version first.`
      );
    }

    // Find all models with the source tag
    const sourceModels = await ctx.db
      .query("modelParameters")
      .withIndex("by_version_tag", (q) => q.eq("versionTag", args.fromTag))
      .collect();

    if (sourceModels.length === 0) {
      throw new Error(`No models found with version tag "${args.fromTag}"`);
    }

    // Copy each model to the new tag and delete the old one
    const renamedIds: string[] = [];
    for (const model of sourceModels) {
      const { _id, _creationTime, ...modelData } = model;
      const newModel = {
        ...modelData,
        versionTag: args.toTag,
      };
      const newId = await ctx.db.insert("modelParameters", newModel);
      renamedIds.push(newId);
      // Delete the old model
      await ctx.db.delete(_id);
    }

    return { renamed: renamedIds.length };
  },
});

/**
 * Delete all models for a specific version tag.
 *
 * @param ctx - Convex context
 * @param args.versionTag - The version tag to delete (e.g., "dev-1", "prod-1")
 * @returns Object with count of models deleted
 */
export const deleteVersion = mutation({
  args: {
    versionTag: v.string(),
  },
  handler: async (ctx, args) => {
    // Prevent deletion of currently active production version
    const config = await getModelConfig(ctx);
    if (config?.productionVersionTag === args.versionTag) {
      throw new Error(
        `Cannot delete active production version tag "${args.versionTag}". Switch to a different version first.`
      );
    }

    // Find all models for this version tag
    const models = await ctx.db
      .query("modelParameters")
      .withIndex("by_version_tag", (q) => q.eq("versionTag", args.versionTag))
      .collect();

    // Delete all models
    for (const model of models) {
      await ctx.db.delete(model._id);
    }

    return { deleted: models.length };
  },
});

/**
 * Set the active production version tag for predictions.
 *
 * @param ctx - Convex context
 * @param args.versionTag - The production version tag to activate (e.g., "prod-1")
 * @returns Success confirmation
 */
export const setProductionVersionTag = mutation({
  args: {
    versionTag: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate that the version tag exists
    const models = await ctx.db
      .query("modelParameters")
      .withIndex("by_version_tag", (q) => q.eq("versionTag", args.versionTag))
      .first();

    if (!models) {
      throw new Error(
        `Production version tag "${args.versionTag}" does not exist. Create it first by copying a dev version.`
      );
    }

    await setProductionVersionTagInternal(ctx, args.versionTag);

    return { success: true };
  },
});

/**
 * Internal helper to set production version tag in config.
 *
 * @param ctx - Convex mutation context
 * @param versionTag - The production version tag
 */
async function setProductionVersionTagInternal(
  ctx: MutationCtx,
  versionTag: string
): Promise<void> {
  const existing = await ctx.db
    .query("modelConfig")
    .withIndex("by_key", (q) => q.eq("key", "productionVersionTag"))
    .first();

  const config = {
    key: "productionVersionTag" as const,
    productionVersionTag: versionTag,
    updatedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.replace(existing._id, config);
  } else {
    await ctx.db.insert("modelConfig", config);
  }
}

/**
 * Get model configuration (internal helper).
 *
 * @param ctx - Convex mutation context
 * @returns Model config or null if not set
 */
async function getModelConfig(ctx: MutationCtx): Promise<{
  productionVersionTag: string | null;
} | null> {
  const config = await ctx.db
    .query("modelConfig")
    .withIndex("by_key", (q) => q.eq("key", "productionVersionTag"))
    .first();

  return config
    ? { productionVersionTag: config.productionVersionTag }
    : { productionVersionTag: null };
}
