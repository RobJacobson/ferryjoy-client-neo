import { v } from "convex/values";
import { api } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import { internalAction } from "../../_generated/server";
import { toConvexCompletedVesselTrip } from "./schemas";

/**
 * Action for adding a completed vessel trip
 * Calculates trip metrics and stores the completed trip
 * Note: The active trip deletion is handled by the calling action (createNewActiveTrip)
 */
export const addCompletedVesselTrip = internalAction({
  args: {
    activeTrip: v.any(), // Doc<"activeVesselTrips"> - using v.any() because Doc types can't be validated
    endTime: v.number(),
  },
  handler: async (ctx, args) => {
    const activeTrip = args.activeTrip as Doc<"activeVesselTrips">;
    const endTime = args.endTime;

    // Calculate completed trip data
    const completedTripData = toConvexCompletedVesselTrip(activeTrip, endTime);
    if (!completedTripData) {
      return;
    }

    // Store in completed trips table
    await ctx.runMutation(api.functions.completedVesselTrips.mutations.insert, {
      trip: completedTripData,
    });

    console.log(
      `Completed trip for ${completedTripData.VesselAbbrev} (${completedTripData.VesselID}): ${JSON.stringify(completedTripData)}`
    );
  },
});
