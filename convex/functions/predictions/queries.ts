import { query } from "_generated/server";
import { v } from "convex/values";

export const getAllModelParameters = query({
  args: {},
  handler: async (ctx) => ctx.db.query("modelParameters").collect(),
});

export const getModelParametersByPair = query({
  args: {
    pairKey: v.string(),
    modelType: v.union(
      v.literal("at-dock-depart-curr"),
      v.literal("at-dock-arrive-next"),
      v.literal("at-dock-depart-next"),
      v.literal("at-sea-arrive-next"),
      v.literal("at-sea-depart-next")
    ),
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("modelParameters")
      .withIndex("by_pair_and_type", (q) =>
        q.eq("pairKey", args.pairKey).eq("modelType", args.modelType)
      )
      .first(),
});
