import { query } from "_generated/server";
import { v } from "convex/values";

/**
 * Gets all model parameters
 */
export const getAllModelParameters = query({
  args: {},
  handler: async (ctx) => ctx.db.query("modelParameters").collect(),
});

/**
 * Gets model parameters by terminal pair and model type
 */
export const getModelParametersByTerminalPair = query({
  args: {
    departingTerminalAbbrev: v.string(),
    arrivingTerminalAbbrev: v.string(),
    modelType: v.union(v.literal("departure"), v.literal("arrival")),
  },
  handler: async (ctx, args) => {
    const model = await ctx.db
      .query("modelParameters")
      .withIndex("by_terminals_and_type", (q) =>
        q
          .eq("departingTerminalAbbrev", args.departingTerminalAbbrev)
          .eq("arrivingTerminalAbbrev", args.arrivingTerminalAbbrev)
          .eq("modelType", args.modelType)
      )
      .first();

    return model;
  },
});

/**
 * Gets all models for a terminal pair (both departure and arrival)
 */
export const getModelsByTerminalPair = query({
  args: {
    departingTerminalAbbrev: v.string(),
    arrivingTerminalAbbrev: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("modelParameters")
      .withIndex("by_terminals", (q) =>
        q
          .eq("departingTerminalAbbrev", args.departingTerminalAbbrev)
          .eq("arrivingTerminalAbbrev", args.arrivingTerminalAbbrev)
      )
      .collect();
  },
});

// /**
//  * Gets all current predictions
//  */
// export const getAllCurrentPredictions = query({
//   args: {},
//   handler: async (ctx) => ctx.db.query("currentPredictions").collect(),
// });

// /**
//  * Gets current predictions by type
//  */
// export const getCurrentPredictionsByType = query({
//   args: {
//     predictionType: v.union(v.literal("departure"), v.literal("arrival")),
//   },
//   handler: async (ctx, args) =>
//     ctx.db
//       .query("currentPredictions")
//       .filter((q) => q.eq(q.field("predictionType"), args.predictionType))
//       .collect(),
// });

// /**
//  * Gets current predictions by route
//  */
// export const getCurrentPredictionsByRoute = query({
//   args: { routeId: v.string() },
//   handler: async (ctx, args) =>
//     ctx.db
//       .query("currentPredictions")
//       .withIndex("by_route", (q) => q.eq("opRouteAbrv", args.routeId))
//       .collect(),
// });

// /**
//  * Gets all historical predictions
//  */
// export const getAllHistoricalPredictions = query({
//   args: {},
//   handler: async (ctx) => ctx.db.query("historicalPredictions").collect(),
// });

// /**
//  * Gets historical predictions by type
//  */
// export const getHistoricalPredictionsByType = query({
//   args: {
//     predictionType: v.union(v.literal("departure"), v.literal("arrival")),
//   },
//   handler: async (ctx, args) =>
//     ctx.db
//       .query("historicalPredictions")
//       .filter((q) => q.eq(q.field("predictionType"), args.predictionType))
//       .collect(),
// });

/**
 * Get the most recent model training timestamp for incremental training
 */
export const getLastTrainingTimestamp = query({
  args: {},
  handler: async (ctx) => {
    const latestModel = await ctx.db
      .query("modelParameters")
      .order("desc")
      .first();

    return latestModel?.createdAt || 0;
  },
});
