/**
 * Internal actions that run keyValueStore setup without direct database access.
 * These orchestrate internal mutations (for example bootstrap of scheduled-trips
 * sync metadata) and are intended for one-off or operational runs, not hot paths.
 */

import { internal } from "_generated/api";
import { internalAction } from "_generated/server";
import { v } from "convex/values";

import { keyValueStoreValueValidator } from "./schemas";

/** Matches `setupInitialSyncDate` return shape; narrows `ctx.runMutation` for TS. */
type SetupInitialSyncDateResult = {
  created: boolean;
  timestamp: string | number | boolean | null;
};

/**
 * Runs key-value setup mutations in sequence for backend bootstrap.
 *
 * Currently invokes `setupInitialSyncDate` so scheduled-trips tooling has a
 * baseline `lastScheduledTripsSyncDate` before first sync.
 *
 * @param ctx - Convex action context
 * @returns An object whose `syncDateSetup` field carries `setupInitialSyncDate`
 *   outcome (`created` plus stored `timestamp`)
 */
export const runAllSetup = internalAction({
  args: {},
  returns: v.object({
    syncDateSetup: v.object({
      created: v.boolean(),
      timestamp: keyValueStoreValueValidator,
    }),
  }),
  handler: async (ctx) => {
    console.log("[SETUP] Running key-value setup");

    const syncDateSetup: SetupInitialSyncDateResult = await ctx.runMutation(
      internal.functions.keyValueStore.migrations.setupInitialSyncDate,
      {}
    );
    console.log("[SETUP] Sync date setup result:", syncDateSetup);

    return {
      syncDateSetup,
    };
  },
});
