// import { v } from "convex/values";
// import type { MutationCtx } from "../../_generated/server";
// import { mutation } from "../../_generated/server";

// import type {
//   ConvexCurrentPredictionData,
//   ConvexModelParameters,
// } from "./schemas";
// import {
//   currentPredictionDataSchema,
//   modelParametersMutationSchema,
// } from "./schemas";

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

// /**
//  * Stores model parameters in the database
//  */
// export const storeModelParametersMutation = mutation({
//   args: {
//     model: modelParametersMutationSchema,
//   },
//   handler: async (ctx, args) => {
//     try {
//       const modelId = await ctx.db.insert(
//         "modelParameters",
//         args.model as ConvexModelParameters
//       );
//       console.log(`Stored model parameters: ${modelId}`);
//       return modelId;
//     } catch (error) {
//       console.error("Failed to store model parameters:", error);
//       throw error;
//     }
//   },
// });

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

// /**
//  * Deletes model parameters by ID
//  */
// export const deleteModelParametersMutation = mutation({
//   args: {
//     modelId: v.id("modelParameters"),
//   },
//   handler: async (ctx, args) => {
//     try {
//       await ctx.db.delete(args.modelId);
//       console.log(`Deleted model parameters: ${args.modelId}`);
//       return { success: true };
//     } catch (error) {
//       console.error("Failed to delete model parameters:", error);
//       throw error;
//     }
//   },
// });
