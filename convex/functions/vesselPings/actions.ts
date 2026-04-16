/**
 * Convex actions for ingesting and retaining vessel ping collections.
 */

import { api, internal } from "_generated/api";
import { internalAction } from "_generated/server";
import { fetchWsfVesselLocations } from "adapters/wsf/fetchVesselLocations";
import type { ConvexVesselPingCollection } from "functions/vesselPings/schemas";
import { toConvexVesselPing } from "functions/vesselPings/schemas";

/**
 * Internal action for fetching and storing vessel locations from the WSF API.
 *
 * @param ctx - Convex internal action context
 * @returns Failure details when ingestion fails; otherwise `undefined`
 */
export const fetchAndStoreVesselPings = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      // Retain the long-standing fetch shape until the downstream parser changes.
      const rawLocations = await fetchWsfVesselLocations();

      const vesselPings = rawLocations
        .filter((vl) => vl.InService)
        .map(toConvexVesselPing);

      if (vesselPings.length === 0) {
        throw new Error("No vessel locations received from WSF API");
      }

      const pingCollection: ConvexVesselPingCollection = {
        timestamp: Date.now(),
        pings: vesselPings,
      };

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
 * Internal action for pruning old vessel ping collection rows.
 *
 * @param ctx - Convex internal action context
 * @returns `undefined` after the cleanup mutation completes
 */
export const cleanupOldPings = internalAction({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(
      internal.functions.vesselPings.mutations.cleanupOldPingsMutation
    );
  },
});

/**
 * Serialize unknown error values for logging without throwing during logging.
 *
 * @param value - Unknown value caught from an action failure path
 * @returns String form suitable for error messages and console output
 */
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
