import { api } from "@convex/_generated/api";
import { internalAction } from "@convex/_generated/server";
import { WsfVessels } from "ws-dottie";

import { toVesselLocation } from "@/data/types/VesselLocation";

import { toConvexVesselLocation } from "./schemas";

/**
 * Internal action for fetching and storing vessel locations from WSF API
 * This is called by cron jobs and makes external HTTP requests
 * Stores data without any filtering or transforming
 */
export const fetchAndStoreVesselLocations = internalAction({
  args: {},
  handler: async (ctx) => {
    // Fetch current vessel data from WSF API
    const rawVesselData = await WsfVessels.getVesselLocations();

    // Map to VesselLocation
    const vesselLocations = rawVesselData.map(toVesselLocation);

    // Validate we got reasonable data
    if (vesselLocations.length === 0) {
      throw new Error("No vessel data received from WSF API");
    }

    // Convert to Convex-safe types (ms/undefined) before crossing action→mutation boundary
    const convexLocations = vesselLocations.map(toConvexVesselLocation);

    // Store locations to database
    await ctx.runMutation(api.functions.vesselLocation.mutations.bulkInsert, {
      locations: convexLocations,
    });
  },
});
