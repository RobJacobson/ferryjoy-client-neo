/**
 * Mutation handlers for storing and pruning legacy individual vessel ping rows.
 */

import { internalMutation, mutation } from "_generated/server";
import { v } from "convex/values";

import type { ConvexVesselPing } from "functions/vesselPings/schemas";
import { vesselPingValidationSchema } from "functions/vesselPings/schemas";

/**
 * Store individual vessel pings to the vesselPing table
 * Takes an array of vessel pings and saves each as a separate document
 *
 * @param ctx - Convex mutation context
 * @param args - Mutation arguments containing vessel ping rows
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
 * Internal mutation for deleting stale legacy vessel ping rows.
 *
 * @param ctx - Convex context
 * @returns Number of records deleted
 */
export const cleanupOldPingsMutation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const CONFIG = { CLEANUP_HOURS: 2, BATCH_SIZE: 50 };
    const cutoffTime = Date.now() - CONFIG.CLEANUP_HOURS * 60 * 60 * 1000;
    let totalDeleted = 0;

    // Batch deletes to keep write contention low during cleanup.
    while (true) {
      const oldPings = await ctx.db
        .query("vesselPing")
        .withIndex("by_timestamp", (q) => q.lt("TimeStamp", cutoffTime))
        .take(CONFIG.BATCH_SIZE);

      if (oldPings.length === 0) {
        break;
      }

      for (const ping of oldPings) {
        await ctx.db.delete(ping._id);
      }

      totalDeleted += oldPings.length;

      if (oldPings.length < CONFIG.BATCH_SIZE) {
        break;
      }
    }

    return totalDeleted;
  },
});
