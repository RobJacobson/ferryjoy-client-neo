import { api, internal } from "@convex/_generated/api";
import { internalAction } from "@convex/_generated/server";

import { toVesselLocation, toVesselPing } from "@domain";

import type { ConvexVesselPing } from "./schemas";
import { toConvexVesselPing } from "./schemas";

/**
 * Internal action for fetching and storing vessel locations from WSF API
 * This is called by cron jobs and makes external HTTP requests
 */
export const fetchAndStoreVesselPings = internalAction({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    success: boolean;
    count: number;
    filtered: number;
    message?: string;
  }> => {
    // Fetch current vessel locations from WSF API
    const { WsfVessels } = await import("ws-dottie");
    const rawLocations = await WsfVessels.getVesselLocations();
    const currLocations = rawLocations
      .map(vl => toVesselLocation(vl))
      .map(toVesselPing)
      .map(toConvexVesselPing);

    // Validate we got reasonable data
    if (currLocations.length === 0) {
      throw new Error("No vessel locations received from WSF API");
    }

    // Store locations to database
    await ctx.runMutation(api.functions.vesselPings.mutations.bulkInsert, {
      locations: currLocations,
    });

    return {
      success: true,
      count: currLocations.length,
      filtered: 0,
      message: `Saved ${currLocations.length} vessel pings`,
    };
  },
});

/**
 * Internal action for cleaning up old vessel ping records
 * Deletes records older than 24 hours to prevent unlimited database growth
 * Uses consolidated internal mutation for better performance and data consistency
 */
export const cleanupOldPings = internalAction({
  args: {},
  handler: async ctx => {
    await ctx.runMutation(
      internal.functions.vesselPings.mutations.cleanupOldPingsMutation
    );
  },
});
