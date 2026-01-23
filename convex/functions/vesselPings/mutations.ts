import { internalMutation, mutation } from "_generated/server";

import type { ConvexVesselPingCollection } from "functions/vesselPings/schemas";
import { vesselPingListValidationSchema } from "functions/vesselPings/schemas";

/**
 * Number of hours old that VesselPings records must be before they are deleted.
 * Records older than this threshold will be removed by the cleanup cron job.
 */
const VESSEL_PINGS_CLEANUP_HOURS = 1;

/**
 * Store a collection of vessel pings as a single document
 * Used by actions to store vessel location data
 *
 * @param ctx - Convex context
 * @param args.collection - Vessel ping collection to store
 * @returns The ID of the inserted document
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
 *
 * @param ctx - Convex context
 * @returns Number of records deleted
 */
export const cleanupOldPingsMutation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const BATCH_SIZE = 50;
    const cutoffTime = Date.now() - VESSEL_PINGS_CLEANUP_HOURS * 60 * 60 * 1000;
    let totalDeleted = 0;

    // Process in batches to reduce write conflicts
    while (true) {
      // Use the index for more efficient querying
      const oldPingCollections = await ctx.db
        .query("vesselPings")
        .withIndex("by_timestamp", (q) => q.lt("timestamp", cutoffTime))
        .take(BATCH_SIZE);

      if (oldPingCollections.length === 0) {
        break; // No more old records to delete
      }

      // Delete all records in this batch
      for (const collection of oldPingCollections) {
        await ctx.db.delete(collection._id);
      }

      totalDeleted += oldPingCollections.length;

      // If we got fewer records than the batch size, we're done
      if (oldPingCollections.length < BATCH_SIZE) {
        break;
      }
    }

    return totalDeleted;
  },
});
