import { v } from "convex/values";
import { mutation } from "../../_generated/server";

import {
  type ConvexVesselLocation,
  vesselLocationValidationSchema,
} from "./schemas";

/**
 * Bulk upsert vessel locations into the database
 * Replaces existing vessel locations that match by VesselID
 *
 * This implementation efficiently batches all reads upfront, then performs
 * all writes in a single transaction. Convex queues all database changes
 * and executes them atomically when the mutation completes.
 */
export const bulkUpsert = mutation({
  args: { locations: v.array(vesselLocationValidationSchema) },
  handler: async (ctx, args: { locations: ConvexVesselLocation[] }) => {
    // Batch read: Fetch all existing vessel locations once
    // Using the index for efficient lookup
    const existingLocations = await ctx.db.query("vesselLocations").collect();

    // Create a Map for O(1) lookups by VesselID
    const existingByVesselId = new Map(
      existingLocations.map((loc) => [loc.VesselID, loc])
    );

    let updatedCount = 0;
    let insertedCount = 0;

    // Process all locations in a single loop
    // All database writes are queued and executed atomically when mutation completes
    for (const location of args.locations) {
      const existing = existingByVesselId.get(location.VesselID);

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
