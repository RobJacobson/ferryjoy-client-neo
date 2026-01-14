import { mutation } from "_generated/server";
import { v } from "convex/values";
import { modelParametersV2Schema } from "functions/predictionsV2/schemas";

export const storeModelParametersV2Mutation = mutation({
  args: {
    model: modelParametersV2Schema,
  },
  handler: async (ctx, args) => {
    // Delete existing models for this bucket+type to avoid duplicates
    const { bucketType, chainKey, pairKey, modelType } = args.model;

    if (bucketType === "chain" && chainKey) {
      const existing = await ctx.db
        .query("modelParametersV2")
        .withIndex("by_chain_and_type", (q) =>
          q.eq("chainKey", chainKey).eq("modelType", modelType)
        )
        .collect();
      for (const doc of existing) {
        await ctx.db.delete(doc._id);
      }
    }

    if (bucketType === "pair" && pairKey) {
      const existing = await ctx.db
        .query("modelParametersV2")
        .withIndex("by_pair_and_type", (q) =>
          q.eq("pairKey", pairKey).eq("modelType", modelType)
        )
        .collect();
      for (const doc of existing) {
        await ctx.db.delete(doc._id);
      }
    }

    return await ctx.db.insert("modelParametersV2", args.model);
  },
});

export const deleteModelParametersV2Mutation = mutation({
  args: { modelId: v.id("modelParametersV2") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.modelId);
    return { success: true };
  },
});

export const deleteAllModelParametersV2Mutation = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("modelParametersV2").collect();
    for (const doc of all) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: all.length };
  },
});
