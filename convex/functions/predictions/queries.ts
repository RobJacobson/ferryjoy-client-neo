import { query } from "@convex/_generated/server";
import { v } from "convex/values";

/**
 * Gets all model parameters
 */
export const getAllModelParameters = query({
  args: {},
  handler: async (ctx) => ctx.db.query("modelParameters").collect(),
});

/**
 * Gets model parameters by route
 */
export const getModelParametersByRoute = query({
  args: { routeId: v.string() },
  handler: async (ctx, args) => {
    const models = await ctx.db
      .query("modelParameters")
      .filter((q) => q.eq(q.field("routeId"), args.routeId))
      .collect();

    // Return the most recent model for this route
    if (models.length > 0) {
      return models.sort((a, b) => b.createdAt - a.createdAt)[0];
    }
    return null;
  },
});

/**
 * Gets all current predictions
 */
export const getAllCurrentPredictions = query({
  args: {},
  handler: async (ctx) => ctx.db.query("currentPredictions").collect(),
});

/**
 * Gets current predictions by type
 */
export const getCurrentPredictionsByType = query({
  args: {
    predictionType: v.union(v.literal("departure"), v.literal("arrival")),
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("currentPredictions")
      .filter((q) => q.eq(q.field("predictionType"), args.predictionType))
      .collect(),
});

/**
 * Gets current predictions by route
 */
export const getCurrentPredictionsByRoute = query({
  args: { routeId: v.string() },
  handler: async (ctx, args) =>
    ctx.db
      .query("currentPredictions")
      .withIndex("by_route", (q) => q.eq("opRouteAbrv", args.routeId))
      .collect(),
});

/**
 * Gets all historical predictions
 */
export const getAllHistoricalPredictions = query({
  args: {},
  handler: async (ctx) => ctx.db.query("historicalPredictions").collect(),
});

/**
 * Gets historical predictions by type
 */
export const getHistoricalPredictionsByType = query({
  args: {
    predictionType: v.union(v.literal("departure"), v.literal("arrival")),
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("historicalPredictions")
      .filter((q) => q.eq(q.field("predictionType"), args.predictionType))
      .collect(),
});
