import { mutation } from "_generated/server";
import { v } from "convex/values";
import { modelParametersSchema } from "functions/predictions/schemas";

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

export const deleteModelParametersMutation = mutation({
  args: { modelId: v.id("modelParameters") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.modelId);
    return { success: true };
  },
});

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
