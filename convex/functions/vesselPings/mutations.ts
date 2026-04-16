/**
 * Mutation handlers for storing and pruning vessel ping collections.
 */

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
 * @param ctx - Convex mutation context
 * @param args - Mutation arguments containing the vessel ping collection
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
 * Internal mutation for deleting stale vessel ping collection rows.
 *
 * @param ctx - Convex internal mutation context
 * @returns Number of records deleted
 */
export const cleanupOldPingsMutation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const BATCH_SIZE = 50;
    const cutoffTime = Date.now() - VESSEL_PINGS_CLEANUP_HOURS * 60 * 60 * 1000;
    let totalDeleted = 0;

    // Batch deletes to keep write contention low during cleanup.
    while (true) {
      const oldPingCollections = await ctx.db
        .query("vesselPings")
        .withIndex("by_timestamp", (q) => q.lt("timestamp", cutoffTime))
        .take(BATCH_SIZE);

      if (oldPingCollections.length === 0) {
        break;
      }

      for (const collection of oldPingCollections) {
        await ctx.db.delete(collection._id);
      }

      totalDeleted += oldPingCollections.length;

      if (oldPingCollections.length < BATCH_SIZE) {
        break;
      }
    }

    return totalDeleted;
  },
});
