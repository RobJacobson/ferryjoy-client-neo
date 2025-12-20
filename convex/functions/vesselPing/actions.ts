import { fetchVesselLocations } from "ws-dottie/wsf-vessels/core";
import { api, internal } from "_generated/api";
import { internalAction } from "_generated/server";

import { toConvexVesselPing } from "functions/vesselPing/schemas";

/**
 * Internal action for fetching and storing vessel locations from WSF API
 * This is called by cron jobs and makes external HTTP requests
 * Stores each vessel ping as an individual document in the vesselPing table
 */
export const fetchAndStoreVesselPing = internalAction({
  args: {},
  handler: async (ctx) => {
    // Fetch current vessel locations from WSF API using the new fetchVesselLocations function
    const rawLocations = await fetchVesselLocations();

    // Transform raw locations to vessel pings and filter in-service vessels
    const vesselPings = rawLocations
      .filter((vl) => vl.InService)
      .map(toConvexVesselPing)
      // Sort by vesselId descending as requested
      .sort((a, b) => b.VesselID - a.VesselID);

    // Validate we got reasonable data
    if (vesselPings.length === 0) {
      throw new Error("No vessel locations received from WSF API");
    }

    // Store each ping as an individual document
    await ctx.runMutation(api.functions.vesselPing.mutations.storeVesselPings, {
      pings: vesselPings,
    });
  },
});

/**
 * Internal action for cleaning up old vessel ping records
 * Deletes records older than 24 hours to prevent unlimited database growth
 * Uses consolidated internal mutation for better performance and data consistency
 */
export const cleanupOldPings = internalAction({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(
      internal.functions.vesselPing.mutations.cleanupOldPingsMutation
    );
  },
});
