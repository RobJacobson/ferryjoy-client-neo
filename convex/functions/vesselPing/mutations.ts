import { internalMutation, mutation } from "_generated/server";
import { v } from "convex/values";

import type { ConvexVesselPing } from "functions/vesselPing/schemas";
import { vesselPingValidationSchema } from "functions/vesselPing/schemas";

/**
 * Store individual vessel pings to the vesselPing table
 * Takes an array of vessel pings and saves each as a separate document
 *
 * @param ctx - Convex context
 * @param args.pings - Array of vessel ping records to store
 * @returns Array of inserted document IDs
 */
export const storeVesselPings = mutation({
  args: {
    pings: v.array(vesselPingValidationSchema),
  },
  handler: async (ctx, args: { pings: ConvexVesselPing[] }) => {
    const ids = [];
    for (const ping of args.pings) {
      const id = await ctx.db.insert("vesselPing", ping);
      ids.push(id);
    }
    return ids;
  },
});

/**
 * Internal mutation for cleaning up old vessel ping records
 * Uses deleteMany for efficient bulk deletion
 * Used by the cleanup cron job for better performance and data consistency
 * @param ctx - Convex context
 * @returns Number of records deleted
 */
export const cleanupOldPingsMutation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const CONFIG = { CLEANUP_HOURS: 2, BATCH_SIZE: 50 };
    const cutoffTime = Date.now() - CONFIG.CLEANUP_HOURS * 60 * 60 * 1000;
    let totalDeleted = 0;

    // Process in batches to reduce write conflicts
    while (true) {
      // Use the index for more efficient querying
      const oldPings = await ctx.db
        .query("vesselPing")
        .withIndex("by_timestamp", (q) => q.lt("TimeStamp", cutoffTime))
        .take(CONFIG.BATCH_SIZE);

      if (oldPings.length === 0) {
        break; // No more old records to delete
      }

      // Delete all records in this batch
      for (const ping of oldPings) {
        await ctx.db.delete(ping._id);
      }

      totalDeleted += oldPings.length;

      // If we got fewer records than the batch size, we're done
      if (oldPings.length < CONFIG.BATCH_SIZE) {
        break;
      }
    }

    return totalDeleted;
  },
});
