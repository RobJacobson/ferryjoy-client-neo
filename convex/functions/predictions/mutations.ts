import type { MutationCtx } from "_generated/server";
import { mutation } from "_generated/server";
import { v } from "convex/values";
import type { ConvexModelParameters } from "functions/predictions/schemas";
import { modelParametersMutationSchema } from "functions/predictions/schemas";


// type PredictionTable = "currentPredictions";

// /**
//  * Helper function to update or create a prediction in the current predictions table
//  */
// const updateOrCreatePrediction = async (
//   ctx: MutationCtx,
//   tableName: PredictionTable,
//   prediction: ConvexCurrentPredictionData
// ) => {
//   const existing = await ctx.db
//     .query(tableName)
//     .withIndex("by_vessel_and_type", (q) =>
//       q
//         .eq("vesselId", prediction.vesselId)
//         .eq("predictionType", prediction.predictionType)
//     )
//     .unique();

//   if (existing) {
//     await ctx.db.patch(existing._id, prediction);
//     console.log(
//       `Updated current ${prediction.predictionType} prediction for vessel ${prediction.vesselId}`
//     );
//   } else {
//     await ctx.db.insert(tableName, prediction);
//     console.log(
//       `Created current ${prediction.predictionType} prediction for vessel ${prediction.vesselId}`
//     );
//   }
// };

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

// /**
//  * Factory function to create prediction update mutations
//  */
// const createPredictionMutation = (tableName: PredictionTable) =>
//   mutation({
//     args: {
//       prediction: currentPredictionDataSchema,
//     },
//     handler: async (ctx, args) => {
//       try {
//         await updateOrCreatePrediction(ctx, tableName, args.prediction);
//       } catch (error) {
//         console.error(`Failed to update current prediction:`, error);
//         throw error;
//       }
//     },
//   });

// /**
//  * Updates current prediction for a vessel (handles both departure and arrival)
//  */
// export const updateCurrentPredictionMutation =
//   createPredictionMutation("currentPredictions");

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
