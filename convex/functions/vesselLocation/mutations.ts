import { v } from "convex/values";
import type { MutationCtx } from "../../_generated/server";
import { mutation } from "../../_generated/server";

import type { ConvexVesselLocation } from "./schemas";
import { toConvexVesselLocation } from "./schemas";

/**
 * Bulk insert vessel locations into the database
 */
export const bulkInsert = mutation({
  args: { locations: v.array(v.any()) },
  handler: async (ctx, args: { locations: ConvexVesselLocation[] }) => {
    for (const cvl of args.locations) {
      await ctx.db.insert("vesselLocations", cvl);
    }
    return { success: true, count: args.locations.length };
  },
});
