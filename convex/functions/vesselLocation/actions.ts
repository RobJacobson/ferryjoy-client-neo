import { fetchVesselLocations } from "ws-dottie/wsf-vessels/core";
import { api } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { toConvexVesselLocation } from "./schemas";

/**
 * Internal action for fetching and storing vessel locations from WSF API
 * This is called by cron jobs and makes external HTTP requests
 * Stores data without any filtering or transforming
 */
export const fetchAndStoreVesselLocations = internalAction({
  args: {},
  handler: async ctx => {
    // Fetch current vessel data from WSF API
    const convexLocations = (await fetchVesselLocations()).map(
      toConvexVesselLocation
    );

    // Store locations to database
    await ctx.runMutation(api.functions.vesselLocation.mutations.bulkInsert, {
      locations: convexLocations,
    });
  },
});
