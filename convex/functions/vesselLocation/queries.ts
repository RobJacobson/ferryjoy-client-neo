import { query } from "../../_generated/server";
import { toDomainVesselLocation } from "./schemas";

/**
 * Get all vessel locations from the database
 */
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const vesselLocations = await ctx.db.query("vesselLocations").collect();
    return vesselLocations.map(toDomainVesselLocation);
  },
});
