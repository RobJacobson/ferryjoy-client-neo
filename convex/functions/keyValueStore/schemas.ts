/**
 * Convex validators and key constants for the generic keyValueStore table.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";

/** Active ML production model version tag (string or null when unset). */
export const KEY_PRODUCTION_VERSION_TAG = "productionVersionTag" as const;

/** Epoch ms of last scheduled-trips sync (used by setup / tooling). */
export const KEY_LAST_SCHEDULED_TRIPS_SYNC_DATE =
  "lastScheduledTripsSyncDate" as const;

export const keyValueStoreValueValidator = v.union(
  v.string(),
  v.number(),
  v.boolean(),
  v.null()
);

export const keyValueStoreSchema = v.object({
  key: v.string(),
  value: keyValueStoreValueValidator,
  updatedAt: v.number(),
});

export type KeyValueStore = Infer<typeof keyValueStoreSchema>;

export const keyValueStoreDocValidator = v.object({
  _id: v.id("keyValueStore"),
  _creationTime: v.number(),
  key: v.string(),
  value: keyValueStoreValueValidator,
  updatedAt: v.number(),
});
