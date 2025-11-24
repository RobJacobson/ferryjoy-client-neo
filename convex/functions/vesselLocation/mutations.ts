import { v } from "convex/values";
import { mutation } from "../../_generated/server";

import type { ConvexVesselLocation } from "./schemas";

/**
 * Bulk upsert vessel locations into the database
 * Replaces existing vessel locations that match by VesselID
 */
export const bulkUpsert = mutation({
  args: { locations: v.array(v.any()) },
  handler: async (ctx, args: { locations: ConvexVesselLocation[] }) => {
    let updatedCount = 0;
    let insertedCount = 0;

    for (const location of args.locations) {
      // Check if a vessel location with this VesselID already exists
      const existing = await ctx.db
        .query("vesselLocations")
        .withIndex("by_vessel_id", (q) => q.eq("VesselID", location.VesselID))
        .first();

      if (existing) {
        // Update the existing record
        await ctx.db.patch(existing._id, location);
        updatedCount++;
      } else {
        // Insert a new record
        await ctx.db.insert("vesselLocations", location);
        insertedCount++;
      }
    }

    return {
      success: true,
      total: args.locations.length,
      updated: updatedCount,
      inserted: insertedCount,
    };
  },
});
