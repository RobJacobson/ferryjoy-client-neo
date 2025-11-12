import { v } from "convex/values";
import { query } from "../../_generated/server";
import type { CurrentVesselLocation } from "./schemas";

/**
 * Get all current vessel locations
 */
export const getAll = query({
  args: {},
  handler: async (ctx): Promise<CurrentVesselLocation[]> => {
    return await ctx.db.query("currentVesselLocations").collect();
  },
});

/**
 * Get a specific vessel's current location by VesselID
 */
export const getByVesselId = query({
  args: {
    vesselId: v.number(),
  },
  handler: async (ctx, { vesselId }): Promise<CurrentVesselLocation | null> => {
    return await ctx.db
      .query("currentVesselLocations")
      .withIndex("by_vessel_id", (q) => q.eq("VesselID", vesselId))
      .unique();
  },
});
