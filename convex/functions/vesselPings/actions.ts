import { fetchVesselLocations } from "ws-dottie/wsf-vessels/core";
import { api, internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";

import type { ConvexVesselPingCollection } from "./schemas";
import { toConvexVesselPing } from "./schemas";

/**
 * Internal action for fetching and storing vessel locations from WSF API
 * This is called by cron jobs and makes external HTTP requests
 */
export const fetchAndStoreVesselPings = internalAction({
  args: {},
  handler: async (ctx) => {
    // Fetch current vessel locations from WSF API using the new fetchVesselLocations function
    const rawLocations = await fetchVesselLocations();

    // Transform raw locations to vessel pings
    const vesselPings = rawLocations
      .filter((vl) => vl.InService)
      .map(toConvexVesselPing);

    // Validate we got reasonable data
    if (vesselPings.length === 0) {
      throw new Error("No vessel locations received from WSF API");
    }

    // Create a collection document with all pings and current timestamp
    const pingCollection: ConvexVesselPingCollection = {
      timestamp: Date.now(),
      pings: vesselPings,
    };

    // Store the collection to database
    await ctx.runMutation(
      api.functions.vesselPings.mutations.storeVesselPingCollection,
      {
        collection: pingCollection,
      }
    );
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
      internal.functions.vesselPings.mutations.cleanupOldPingsMutation
    );
  },
});
