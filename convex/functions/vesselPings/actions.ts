/**
 * Convex actions for ingesting and retaining vessel ping collections.
 */

import { api, internal } from "_generated/api";
import { internalAction } from "_generated/server";
import { fetchWsfVesselPings } from "adapters";
import type { VesselIdentity } from "functions/vessels/schemas";

const CLEANUP_OLD_PINGS_BATCH_SIZE = 200;

/**
 * Ingests WSF vessel pings and stores them in `vesselPings`.
 *
 * Loads identities from `getAllVesselIdentities`, fetches pings from the adapter,
 * then calls the public `storeVesselPings` mutation. Swallows errors into a
 * structured return for cron resilience.
 *
 * @param ctx - Convex internal action context
 * @returns `{ success: false, error }` on failure; `undefined` on success
 */
export const fetchAndStoreVesselPings = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      const vessels = (await ctx.runQuery(
        internal.functions.vesselLocation.queries.getAllVesselIdentities
      )) satisfies ReadonlyArray<VesselIdentity>;

      const vesselPings = await fetchWsfVesselPings(vessels);

      await ctx.runMutation(
        api.functions.vesselPings.mutations.storeVesselPings,
        {
          pings: vesselPings,
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
 * Deletes stale `vesselPings` rows in a retention window (default one hour).
 *
 * Repeats `cleanupOldPingsMutation` with a fixed batch size until `hasMore` is
 * false, logging progress between batches.
 *
 * @param ctx - Convex internal action context
 * @returns Total rows deleted across all batches in this run
 */
export const cleanupOldPings = internalAction({
  args: {},
  handler: async (ctx) => {
    const cutoffMs = Date.now() - 60 * 60 * 1_000;
    let totalDeleted = 0;
    let batchCount = 0;

    while (true) {
      const result = await ctx.runMutation(
        internal.functions.vesselPings.mutations.cleanupOldPingsMutation,
        {
          cutoffMs,
          limit: CLEANUP_OLD_PINGS_BATCH_SIZE,
        }
      );

      batchCount += 1;
      totalDeleted += result.deleted;

      console.log("[vesselPings.cleanupOldPings] batch processed", {
        batchCount,
        batchDeleted: result.deleted,
        totalDeleted,
        hasMore: result.hasMore,
      });

      if (!result.hasMore) {
        break;
      }
    }

    console.log("[vesselPings.cleanupOldPings] run complete", {
      batchCount,
      totalDeleted,
      cutoffMs,
    });

    return totalDeleted;
  },
});

/**
 * Serializes unknown caught values for safe logging strings.
 *
 * Prefers JSON when possible so action failure paths can log structured detail
 * without risking a second throw from circular data.
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
