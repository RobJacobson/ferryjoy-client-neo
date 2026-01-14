import type { Infer } from "convex/values";
import { v } from "convex/values";

export const modelParametersV2Schema = v.object({
  bucketType: v.union(v.literal("chain"), v.literal("pair")),
  chainKey: v.optional(v.string()), // present when bucketType === "chain"
  pairKey: v.optional(v.string()), // present when bucketType === "pair"

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

  featureKeys: v.array(v.string()),
  coefficients: v.array(v.number()),
  intercept: v.number(),

  testMetrics: v.object({
    mae: v.number(),
    rmse: v.number(),
    r2: v.number(),
  }),

  createdAt: v.number(),

  bucketStats: v.object({
    totalRecords: v.number(),
    sampledRecords: v.number(),
  }),
});

export type ConvexModelParametersV2 = Infer<typeof modelParametersV2Schema>;
