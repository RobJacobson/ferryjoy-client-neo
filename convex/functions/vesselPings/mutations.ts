import type { Id } from "@convex/_generated/dataModel";
import { internalMutation, mutation } from "@convex/_generated/server";
import { v } from "convex/values";

import type { ConvexVesselPing } from "./schemas";
import { vesselPingValidationSchema } from "./schemas";

/**
 * Bulk insert multiple vessel ping records
 * Used by actions to store vessel location data
 */
export const bulkInsert = mutation({
  args: {
    locations: v.array(vesselPingValidationSchema),
  },
  handler: async (ctx, args: { locations: ConvexVesselPing[] }) => {
    for (const location of args.locations) {
      await ctx.db.insert("vesselPings", location);
    }
  },
});

/**
 * Internal mutation for cleaning up old vessel ping records
 * Uses deleteMany for efficient bulk deletion
 * Used by the cleanup cron job for better performance and data consistency
 */
export const cleanupOldPingsMutation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const CONFIG = { CLEANUP_HOURS: 2 };
    const cutoffTime = Date.now() - CONFIG.CLEANUP_HOURS * 60 * 60 * 1000;

    // Get the records first, then delete in a single transaction
    const oldPings = await ctx.db
      .query("vesselPings")
      .filter((q) => q.lt(q.field("TimeStamp"), cutoffTime))
      .collect();

    // Delete all records in a single transaction
    for (const ping of oldPings) {
      await ctx.db.delete(ping._id);
    }

    return oldPings.length;
  },
});
