import { mutation } from "_generated/server";
import { v } from "convex/values";
import {
  modelParametersSchema,
  predictionRecordSchema,
} from "functions/predictions/schemas";

/**
 * Store trained ML model parameters in the database
 * Handles deduplication by deleting existing models for the same bucket+type combination
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
    // Delete existing models for this bucket+type to avoid duplicates
    const { bucketType, pairKey, modelType } = args.model;

    if (bucketType === "pair" && pairKey) {
      const existing = await ctx.db
        .query("modelParameters")
        .withIndex("by_pair_and_type", (q) =>
          q.eq("pairKey", pairKey).eq("modelType", modelType)
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
