import { internalMutation, mutation } from "../../_generated/server";

import type { ConvexVesselPingCollection } from "./schemas";
import { vesselPingCollectionValidationSchema } from "./schemas";

/**
 * Store a collection of vessel pings as a single document
 * Used by actions to store vessel location data
 */
export const storeVesselPingCollection = mutation({
  args: {
    collection: vesselPingCollectionValidationSchema,
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
  handler: async ctx => {
    const CONFIG = { CLEANUP_HOURS: 2 };
    const cutoffTime = Date.now() - CONFIG.CLEANUP_HOURS * 60 * 60 * 1000;

    // Get the records first, then delete in a single transaction
    const oldPingCollections = await ctx.db
      .query("vesselPings")
      .filter(q => q.lt(q.field("timestamp"), cutoffTime))
      .collect();

    // Delete all records in a single transaction
    for (const collection of oldPingCollections) {
      await ctx.db.delete(collection._id);
    }

    return oldPingCollections.length;
  },
});
