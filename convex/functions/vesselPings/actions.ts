/**
 * Convex actions for ingesting and retaining vessel ping collections.
 */

import { api, internal } from "_generated/api";
import { internalAction } from "_generated/server";
import { fetchWsfVesselLocations } from "adapters/wsf/fetchVesselLocations";
import type { ConvexVesselPingCollection } from "functions/vesselPings/schemas";
import { toConvexVesselPing } from "functions/vesselPings/schemas";

/**
 * Internal action for fetching and storing vessel locations from WSF API
 * This is called by cron jobs and makes external HTTP requests
 *
 * @param ctx - Convex context
 */
export const fetchAndStoreVesselPings = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      // Fetch current vessel locations from WSF API using the direct long-standing call shape
      const rawLocations = await fetchWsfVesselLocations();

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
    } catch (error) {
      const normalized =
        error instanceof Error ? error : new Error(safeSerialize(error));
      console.error("fetchAndStoreVesselPings failed:", normalized);
      return {
        success: false,
        error: normalized.message,
      };
    }
  },
});

/**
 * Internal action for cleaning up old vessel ping records
 * Deletes records older than 24 hours to prevent unlimited database growth
 * Uses consolidated internal mutation for better performance and data consistency
 *
 * @param ctx - Convex context
 */
export const cleanupOldPings = internalAction({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(
      internal.functions.vesselPings.mutations.cleanupOldPingsMutation
    );
  },
});

const safeSerialize = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};
