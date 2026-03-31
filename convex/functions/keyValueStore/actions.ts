/**
 * Actions that orchestrate keyValueStore migrations (no direct DB access).
 */

import { internal } from "_generated/api";
import { internalAction } from "_generated/server";
import { v } from "convex/values";

import { keyValueStoreValueValidator } from "./schemas";

type MlMigrationResult = {
  migrated: number;
  skipped: number;
  total: number;
};

type SyncDateSetupResult = {
  created: boolean;
  timestamp: string | number | boolean | null;
};

type RunAllSetupResult = {
  mlMigration: MlMigrationResult;
  syncDateSetup: SyncDateSetupResult;
};

/**
 * Runs modelConfig migration and scheduled-trips sync date setup in sequence.
 *
 * @param ctx - Convex action context
 * @returns Results from both internal mutations
 */
export const runAllSetup = internalAction({
  args: {},
  returns: v.object({
    mlMigration: v.object({
      migrated: v.number(),
      skipped: v.number(),
      total: v.number(),
    }),
    syncDateSetup: v.object({
      created: v.boolean(),
      timestamp: keyValueStoreValueValidator,
    }),
  }),
  handler: async (ctx): Promise<RunAllSetupResult> => {
    console.log("[SETUP] Running all migrations and setup");

    const mlResult: MlMigrationResult = await ctx.runMutation(
      internal.functions.keyValueStore.migrations
        .migrateModelConfigToKeyValueStore,
      {}
    );
    console.log("[SETUP] ML migration result:", mlResult);

    const syncResult: SyncDateSetupResult = await ctx.runMutation(
      internal.functions.keyValueStore.migrations.setupInitialSyncDate,
      {}
    );
    console.log("[SETUP] Sync date setup result:", syncResult);

    return {
      mlMigration: mlResult,
      syncDateSetup: syncResult,
    };
  },
});
