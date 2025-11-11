import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "../../_generated/server";
import { mutation } from "../../_generated/server";

import {
  type ConvexCompletedVesselTrip,
  completedVesselTripSchema,
} from "./schemas";

/**
 * Insert a single completed vessel trip into the database
 */
export const insert = mutation({
  args: {
    trip: completedVesselTripSchema,
  },
  handler: async (ctx, args: { trip: ConvexCompletedVesselTrip }) => {
    try {
      await ctx.db.insert("completedVesselTrips", args.trip);
    } catch (error) {
      throw new ConvexError({
        message: `Failed to insert completed vessel trip for ${args.trip.VesselName}`,
        code: "COMPLETED_INSERT_FAILED",
        severity: "error",
        details: { vesselId: args.trip.VesselID, error: String(error) },
      });
    }
  },
});
