import { mutation } from "_generated/server";
import type { MutationCtx } from "_generated/server";
import { v } from "convex/values";
import {
  mlConfigSchema,
  modelParametersSchema,
  predictionRecordSchema,
} from "functions/predictions/schemas";

/**
 * Store trained ML model parameters in the database.
 * For dev-temp versions, deletes existing dev-temp for the same bucket+type.
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
    const { bucketType, pairKey, modelType, versionType, versionNumber } =
      args.model;

    // For dev-temp, delete any existing dev-temp for the same pair+type
    // This ensures only one dev-temp exists at a time
    if (
      bucketType === "pair" &&
      pairKey &&
      versionType === "dev" &&
      versionNumber === -1
    ) {
      const existing = await ctx.db
        .query("modelParameters")
        .withIndex("by_pair_type_version", (q) =>
          q
            .eq("pairKey", pairKey)
            .eq("modelType", modelType)
            .eq("versionType", "dev")
            .eq("versionNumber", -1)
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
 * Promote dev-temp models to a named dev version.
 * Copies all dev-temp models to dev-{versionNumber} and deletes dev-temp.
 *
 * @param ctx - Convex context
 * @param args.versionNumber - The dev version number to promote to (must be positive)
 * @returns Object with count of models promoted
 */
export const promoteDevTempToDev = mutation({
  args: {
    versionNumber: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.versionNumber <= 0) {
      throw new Error("Version number must be positive");
    }

    // Find all dev-temp models
    const devTempModels = await ctx.db
      .query("modelParameters")
      .withIndex("by_version", (q) =>
        q.eq("versionType", "dev").eq("versionNumber", -1)
      )
      .collect();

    // Copy each to dev-{versionNumber}
    const promotedIds: string[] = [];
    for (const model of devTempModels) {
      const { _id, _creationTime, ...modelData } = model;
      const newModel = {
        ...modelData,
        versionNumber: args.versionNumber,
      };
      const newId = await ctx.db.insert("modelParameters", newModel);
      promotedIds.push(newId);
      // Delete the dev-temp version
      await ctx.db.delete(_id);
    }

    return { promoted: promotedIds.length };
  },
});

/**
 * Promote dev version models to a production version.
 * Copies all models from dev-{devVersion} to prod-{prodVersion}.
 * Does not delete the dev version (keeps for reference).
 *
 * @param ctx - Convex context
 * @param args.devVersion - The dev version number to promote from
 * @param args.prodVersion - The prod version number to promote to (must be positive)
 * @returns Object with count of models promoted
 */
export const promoteDevToProd = mutation({
  args: {
    devVersion: v.number(),
    prodVersion: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.devVersion <= 0) {
      throw new Error("Dev version number must be positive");
    }
    if (args.prodVersion <= 0) {
      throw new Error("Prod version number must be positive");
    }

    // Find all dev-{devVersion} models
    const devModels = await ctx.db
      .query("modelParameters")
      .withIndex("by_version", (q) =>
        q.eq("versionType", "dev").eq("versionNumber", args.devVersion)
      )
      .collect();

    // Copy each to prod-{prodVersion}
    const promotedIds: string[] = [];
    for (const model of devModels) {
      const { _id, _creationTime, ...modelData } = model;
      const newModel = {
        ...modelData,
        versionType: "prod" as const,
        versionNumber: args.prodVersion,
      };
      const newId = await ctx.db.insert("modelParameters", newModel);
      promotedIds.push(newId);
    }

    // Update production version config
    await setProductionVersionInternal(ctx, args.prodVersion);

    return { promoted: promotedIds.length };
  },
});

/**
 * Delete all models for a specific version.
 *
 * @param ctx - Convex context
 * @param args.versionType - The version type ("dev" or "prod")
 * @param args.versionNumber - The version number to delete
 * @returns Object with count of models deleted
 */
export const deleteVersion = mutation({
  args: {
    versionType: v.union(v.literal("dev"), v.literal("prod")),
    versionNumber: v.number(),
  },
  handler: async (ctx, args) => {
    // Prevent deletion of currently active production version
    if (args.versionType === "prod") {
      const config = await getMLConfig(ctx);
      if (config?.productionVersion === args.versionNumber) {
        throw new Error(
          `Cannot delete active production version ${args.versionNumber}. Switch to a different version first.`
        );
      }
    }

    // Find all models for this version
    const models = await ctx.db
      .query("modelParameters")
      .withIndex("by_version", (q) =>
        q
          .eq("versionType", args.versionType)
          .eq("versionNumber", args.versionNumber)
      )
      .collect();

    // Delete all models
    for (const model of models) {
      await ctx.db.delete(model._id);
    }

    return { deleted: models.length };
  },
});

/**
 * Set the active production version for predictions.
 *
 * @param ctx - Convex context
 * @param args.prodVersion - The production version number to activate
 * @returns Success confirmation
 */
export const setProductionVersion = mutation({
  args: {
    prodVersion: v.number(),
  },
  handler: async (ctx, args) => {
    // Validate that the prod version exists
    const models = await ctx.db
      .query("modelParameters")
      .withIndex("by_version", (q) =>
        q.eq("versionType", "prod").eq("versionNumber", args.prodVersion)
      )
      .first();

    if (!models) {
      throw new Error(
        `Production version ${args.prodVersion} does not exist. Create it first by promoting a dev version.`
      );
    }

    await setProductionVersionInternal(ctx, args.prodVersion);

    return { success: true };
  },
});

/**
 * Internal helper to set production version in config.
 *
 * @param ctx - Convex mutation context
 * @param prodVersion - The production version number
 */
async function setProductionVersionInternal(
  ctx: MutationCtx,
  prodVersion: number
): Promise<void> {
  const existing = await ctx.db
    .query("mlConfig")
    .withIndex("by_key", (q) => q.eq("key", "productionVersion"))
    .first();

  const config = {
    key: "productionVersion" as const,
    productionVersion: prodVersion,
    updatedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.replace(existing._id, config);
  } else {
    await ctx.db.insert("mlConfig", config);
  }
}

/**
 * Get ML configuration (internal helper).
 *
 * @param ctx - Convex mutation context
 * @returns ML config or null if not set
 */
async function getMLConfig(ctx: MutationCtx): Promise<{
  productionVersion: number | null;
} | null> {
  const config = await ctx.db
    .query("mlConfig")
    .withIndex("by_key", (q) => q.eq("key", "productionVersion"))
    .first();

  return config
    ? { productionVersion: config.productionVersion }
    : { productionVersion: null };
}
