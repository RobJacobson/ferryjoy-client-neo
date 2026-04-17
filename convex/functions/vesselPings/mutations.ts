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

/**
 * Inserts each ping as its own document in `vesselPings`.
 *
 * @param ctx - Convex mutation context
 * @param args - Batch of pings from ingestion
 * @returns Inserted document IDs
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
 * Deletes vessel ping rows older than the retention window.
 *
 * @param ctx - Convex internal mutation context
 * @returns Number of rows deleted
 */
export const cleanupOldPingsMutation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const BATCH_SIZE = 50;
    const cutoffTime = Date.now() - VESSEL_PINGS_CLEANUP_HOURS * 60 * 60 * 1000;
    let totalDeleted = 0;

    while (true) {
      const oldPings = await ctx.db
        .query("vesselPings")
        .withIndex("by_timestamp", (q) => q.lt("TimeStamp", cutoffTime))
        .take(BATCH_SIZE);

      if (oldPings.length === 0) {
        break;
      }

      for (const ping of oldPings) {
        await ctx.db.delete(ping._id);
      }

      totalDeleted += oldPings.length;

      if (oldPings.length < BATCH_SIZE) {
        break;
      }
    }

    return totalDeleted;
  },
});
