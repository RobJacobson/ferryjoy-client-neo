import { mutation } from "_generated/server";
import { v } from "convex/values";
import { modelParametersMutationSchema } from "functions/predictions/schemas";

/**
 * Stores model parameters in the database
 */
export const storeModelParametersMutation = mutation({
  args: {
    model: modelParametersMutationSchema,
  },
  handler: async (ctx, args) => {
    try {
      // Delete existing models for this terminal pair and model type to avoid duplicates
      const existingModels = await ctx.db
        .query("modelParameters")
        .withIndex("by_terminals_and_type", (q) =>
          q
            .eq("departingTerminalAbbrev", args.model.departingTerminalAbbrev)
            .eq("arrivingTerminalAbbrev", args.model.arrivingTerminalAbbrev)
            .eq("modelType", args.model.modelType)
        )
        .collect();

      // Delete existing models (overwrite behavior)
      for (const existing of existingModels) {
        await ctx.db.delete(existing._id);
      }

      const modelId = await ctx.db.insert(
        "modelParameters",
        args.model
      );
      return modelId;
    } catch (error) {
      console.error("Failed to store model parameters:", error);
      throw error;
    }
  },
});

/**
 * Deletes model parameters by ID
 */
export const deleteModelParametersMutation = mutation({
  args: {
    modelId: v.id("modelParameters"),
  },
  handler: async (ctx, args) => {
    try {
      await ctx.db.delete(args.modelId);
      return { success: true };
    } catch (error) {
      console.error("Failed to delete model parameters:", error);
      throw error;
    }
  },
});
