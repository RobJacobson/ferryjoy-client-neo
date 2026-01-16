import { query } from "_generated/server";
import { v } from "convex/values";
import { modelTypeValidator, predictionTypeValidator } from "./schemas";

export const getAllModelParameters = query({
  args: {},
  handler: async (ctx) => ctx.db.query("modelParameters").collect(),
});

export const getModelParametersByPair = query({
  args: {
    pairKey: v.string(),
    modelType: modelTypeValidator,
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("modelParameters")
      .withIndex("by_pair_and_type", (q) =>
        q.eq("pairKey", args.pairKey).eq("modelType", args.modelType)
      )
      .first(),
});

/**
 * Get all predictions for a specific trip key
 */
export const getPredictionsByKey = query({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("predictions")
      .withIndex("by_key", (q) => q.eq("Key", args.key))
      .collect(),
});

/**
 * Get all predictions for a specific vessel
 */
export const getPredictionsByVessel = query({
  args: {
    vesselAbbreviation: v.string(),
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("predictions")
      .withIndex("by_vessel_abbreviation", (q) =>
        q.eq("VesselAbbreviation", args.vesselAbbreviation)
      )
      .collect(),
});

/**
 * Get all predictions for a specific model type
 */
export const getPredictionsByType = query({
  args: {
    predictionType: predictionTypeValidator,
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("predictions")
      .withIndex("by_prediction_type", (q) =>
        q.eq("PredictionType", args.predictionType)
      )
      .collect(),
});

/**
 * Get predictions for a specific vessel and model type
 */
export const getPredictionsByVesselAndType = query({
  args: {
    vesselAbbreviation: v.string(),
    predictionType: predictionTypeValidator,
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("predictions")
      .withIndex("by_vessel_and_type", (q) =>
        q
          .eq("VesselAbbreviation", args.vesselAbbreviation)
          .eq("PredictionType", args.predictionType)
      )
      .collect(),
});

/**
 * Get predictions within a date range (based on PredTime)
 */
export const getPredictionsByDateRange = query({
  args: {
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("predictions")
      .withIndex("by_pred_time", (q) =>
        q.gte("PredTime", args.startTime).lte("PredTime", args.endTime)
      )
      .collect(),
});
