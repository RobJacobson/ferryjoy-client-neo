import type { Infer } from "convex/values";
import { v } from "convex/values";

export const modelParametersSchema = v.object({
  bucketType: v.union(v.literal("pair")),
  pairKey: v.optional(v.string()), // present when bucketType === "pair"

  modelType: v.union(
    v.literal("at-dock-depart-curr"),
    v.literal("at-dock-arrive-next"),
    v.literal("at-dock-depart-next"),
    v.literal("at-sea-arrive-next"),
    v.literal("at-sea-depart-next")
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

export type ConvexModelParameters = Infer<typeof modelParametersSchema>;
