import { query } from "_generated/server";
import { v } from "convex/values";

export const getAllModelParametersV2 = query({
  args: {},
  handler: async (ctx) => ctx.db.query("modelParametersV2").collect(),
});

export const getModelParametersV2ByChain = query({
  args: {
    chainKey: v.string(),
    modelType: v.union(
      v.literal("in-service-at-dock-depart-b"),
      v.literal("in-service-at-dock-arrive-c"),
      v.literal("in-service-at-dock-depart-c"),
      v.literal("in-service-at-sea-arrive-c"),
      v.literal("in-service-at-sea-depart-c"),
      v.literal("layover-at-dock-depart-b"),
      v.literal("layover-at-dock-arrive-c"),
      v.literal("layover-at-dock-depart-c"),
      v.literal("layover-at-sea-arrive-c"),
      v.literal("layover-at-sea-depart-c")
    ),
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("modelParametersV2")
      .withIndex("by_chain_and_type", (q) =>
        q.eq("chainKey", args.chainKey).eq("modelType", args.modelType)
      )
      .first(),
});

export const getModelParametersV2ByPair = query({
  args: {
    pairKey: v.string(),
    modelType: v.union(
      v.literal("in-service-at-dock-depart-b"),
      v.literal("in-service-at-dock-arrive-c"),
      v.literal("in-service-at-dock-depart-c"),
      v.literal("in-service-at-sea-arrive-c"),
      v.literal("in-service-at-sea-depart-c"),
      v.literal("layover-at-dock-depart-b"),
      v.literal("layover-at-dock-arrive-c"),
      v.literal("layover-at-dock-depart-c"),
      v.literal("layover-at-sea-arrive-c"),
      v.literal("layover-at-sea-depart-c")
    ),
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("modelParametersV2")
      .withIndex("by_pair_and_type", (q) =>
        q.eq("pairKey", args.pairKey).eq("modelType", args.modelType)
      )
      .first(),
});
