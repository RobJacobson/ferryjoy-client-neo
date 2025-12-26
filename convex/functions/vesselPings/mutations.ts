import { internalMutation, mutation } from "_generated/server";

import type { ConvexVesselPingCollection } from "functions/vesselPings/schemas";
import { vesselPingListValidationSchema } from "functions/vesselPings/schemas";

/**
 * Store a collection of vessel pings as a single document
 * Used by actions to store vessel location data
 */
export const storeVesselPingCollection = mutation({
  args: {
    collection: vesselPingListValidationSchema,
  },
  handler: async (ctx, args: { collection: ConvexVesselPingCollection }) => {
    return await ctx.db.insert("vesselPings", args.collection);
  },
});

/**
 * Internal mutation for cleaning up old vessel ping collection records
 * Uses deleteMany for efficient bulk deletion
 * Used by the cleanup cron job for better performance and data consistency
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
      const oldPingCollections = await ctx.db
        .query("vesselPings")
        .withIndex("by_timestamp", (q) => q.lt("timestamp", cutoffTime))
        .take(CONFIG.BATCH_SIZE);

      if (oldPingCollections.length === 0) {
        break; // No more old records to delete
      }

      // Delete all records in this batch
      for (const collection of oldPingCollections) {
        await ctx.db.delete(collection._id);
      }

      totalDeleted += oldPingCollections.length;

      // If we got fewer records than the batch size, we're done
      if (oldPingCollections.length < CONFIG.BATCH_SIZE) {
        break;
      }
    }

    return totalDeleted;
  },
});
