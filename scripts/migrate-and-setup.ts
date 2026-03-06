/**
 * @fileoverview Script to migrate modelConfig to keyValueStore and set up initial sync date
 *
 * This script:
 * 1. Migrates ML modelConfig data to keyValueStore
 * 2. Sets initial sync date to enable cache flush checking
 */

import { internalAction, internalMutation } from "./convex/_generated/server";

/**
 * Migrate modelConfig to keyValueStore
 */
export const migrateModelConfigToKeyValueStore = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("[MIGRATION] Starting modelConfig to keyValueStore migration");

    // Get all entries from modelConfig
    const modelConfigEntries = await ctx.db.query("modelConfig").collect();

    console.log(
      `[MIGRATION] Found ${modelConfigEntries.length} entries in modelConfig`
    );

    let migratedCount = 0;
    let skippedCount = 0;

    for (const entry of modelConfigEntries) {
      // Check if already migrated
      const existingInKvStore = await ctx.db
        .query("keyValueStore")
        .withIndex("by_key", (q) => q.eq("key", entry.key))
        .first();

      if (existingInKvStore) {
        console.log(`[MIGRATION] Skipping ${entry.key} - already migrated`);
        skippedCount++;
        continue;
      }

      // Map modelConfig fields to keyValueStore format
      const kvEntry = {
        key: entry.key,
        value: entry.productionVersionTag,
        updatedAt: entry.updatedAt,
      };

      await ctx.db.insert("keyValueStore", kvEntry);
      console.log(
        `[MIGRATION] Migrated ${entry.key}: ${entry.productionVersionTag}`
      );
      migratedCount++;
    }

    console.log(
      `[MIGRATION] Migration complete: ${migratedCount} migrated, ${skippedCount} skipped`
    );

    return {
      migrated: migratedCount,
      skipped: skippedCount,
      total: modelConfigEntries.length,
    };
  },
});

/**
 * Set up initial sync date for scheduled trips
 */
export const setupInitialSyncDate = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("[SETUP] Setting up initial sync date for scheduled trips");

    // Check if sync date already exists
    const existingSyncDate = await ctx.db
      .query("keyValueStore")
      .withIndex("by_key", (q) => q.eq("key", "lastScheduledTripsSyncDate"))
      .first();

    if (existingSyncDate) {
      console.log(
        "[SETUP] Sync date already exists:",
        new Date(Number(existingSyncDate.value)).toISOString()
      );
      return {
        created: false,
        timestamp: existingSyncDate.value,
      };
    }

    // Set to yesterday so the cache flush check will trigger a sync
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    const entry = {
      key: "lastScheduledTripsSyncDate",
      value: yesterday,
      updatedAt: Date.now(),
    };

    await ctx.db.insert("keyValueStore", entry);
    console.log(
      "[SETUP] Set initial sync date to:",
      new Date(yesterday).toISOString()
    );

    return {
      created: true,
      timestamp: yesterday,
    };
  },
});

/**
 * Run both migrations and setup
 */
export const runAllSetup = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("[SETUP] Running all migrations and setup");

    // Run modelConfig migration
    const mlResult = await ctx.runMutation(
      migrateModelConfigToKeyValueStore,
      {}
    );
    console.log("[SETUP] ML migration result:", mlResult);

    // Set up initial sync date
    const syncResult = await ctx.runMutation(setupInitialSyncDate, {});
    console.log("[SETUP] Sync date setup result:", syncResult);

    return {
      mlMigration: mlResult,
      syncDateSetup: syncResult,
    };
  },
});
