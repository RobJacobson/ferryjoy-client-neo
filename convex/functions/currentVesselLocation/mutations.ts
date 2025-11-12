import { v } from "convex/values";
import { api } from "../../_generated/api";
import { mutation } from "../../_generated/server";
import type { CurrentVesselLocation } from "./schemas";

/**
 * Upsert a vessel location by VesselID
 */
export const upsertByVesselId = mutation({
  args: {
    vesselLocation: v.any(),
  },
  handler: async (
    ctx,
    { vesselLocation }: { vesselLocation: CurrentVesselLocation }
  ) => {
    // Check if a record for this vessel already exists
    const existing = await ctx.db
      .query("currentVesselLocations")
      .withIndex("by_vessel_id", (q) =>
        q.eq("VesselID", vesselLocation.VesselID)
      )
      .unique();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, vesselLocation);
    } else {
      // Insert new record
      await ctx.db.insert("currentVesselLocations", vesselLocation);
    }
  },
});

/**
 * Bulk upsert vessel locations
 */
export const bulkUpsert = mutation({
  args: {
    locations: v.array(v.any()),
  },
  handler: async (
    ctx,
    { locations }: { locations: CurrentVesselLocation[] }
  ) => {
    for (const location of locations) {
      await ctx.runMutation(
        api.functions.currentVesselLocation.mutations.upsertByVesselId,
        { vesselLocation: location }
      );
    }
  },
});
