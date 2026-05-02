/**
 * Mutation handlers for storing and pruning individual vessel ping rows.
 */

import { internalMutation, mutation } from "_generated/server";
import { v } from "convex/values";

import type { ConvexVesselPing } from "functions/vesselPings/schemas";
import { vesselPingValidationSchema } from "functions/vesselPings/schemas";

/**
 * Number of hours old that vessel ping rows must be before they are deleted.
 */
const VESSEL_PINGS_CLEANUP_HOURS = 1;
const VESSEL_PINGS_CLEANUP_BATCH_LIMIT_MAX = 1_000;

const cleanupOldPingsBatchResult = v.object({
  deleted: v.number(),
  hasMore: v.boolean(),
});

/**
 * Inserts a batch of vessel pings as individual documents.
 *
 * Public mutation used by the ingestion action; returns inserted ids in the same
 * order as the input array for simple diagnostics.
 *
 * @param ctx - Convex mutation context
 * @param args - Batch of pings from ingestion
 * @returns New `_id` values in insertion order
 */
export const storeVesselPings = mutation({
  args: {
    pings: v.array(vesselPingValidationSchema),
  },
  handler: async (ctx, args: { pings: ConvexVesselPing[] }) => {
    const ids = [];
    for (const ping of args.pings) {
      ids.push(await ctx.db.insert("vesselPings", ping));
    }
    return ids;
  },
});

/**
 * Deletes one bounded batch of pings older than a cutoff timestamp.
 *
 * Uses `by_timestamp` with `lt`; when the batch fills `limit`, `hasMore` hints
 * that the caller should schedule another pass.
 *
 * @param ctx - Convex internal mutation context
 * @param args - Optional cutoff and required batch limit for this run
 * @returns Deleted count and whether another batch likely remains
 */
export const cleanupOldPingsMutation = internalMutation({
  args: {
    cutoffMs: v.optional(v.number()),
    limit: v.number(),
  },
  returns: cleanupOldPingsBatchResult,
  handler: async (ctx, args) => {
    const cutoffMs =
      args.cutoffMs ??
      Date.now() - VESSEL_PINGS_CLEANUP_HOURS * 60 * 60 * 1_000;
    const limit = Math.max(
      1,
      Math.min(args.limit, VESSEL_PINGS_CLEANUP_BATCH_LIMIT_MAX)
    );

    const oldPings = await ctx.db
      .query("vesselPings")
      .withIndex("by_timestamp", (q) => q.lt("TimeStamp", cutoffMs))
      .take(limit);

    for (const ping of oldPings) {
      await ctx.db.delete(ping._id);
    }

    return {
      deleted: oldPings.length,
      hasMore: oldPings.length === limit,
    };
  },
});
