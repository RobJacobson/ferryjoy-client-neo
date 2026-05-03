/**
 * Shared helpers for reading and writing the `keyValueStore` table. Mutations,
 * queries, and domain code import these to keep keyed lookups and upserts
 * consistent (single place for table name, index usage, and ML config keys).
 */

import type { MutationCtx, QueryCtx } from "_generated/server";
import { KEY_PRODUCTION_VERSION_TAG, type KeyValueStore } from "./schemas";

/**
 * Returns the `keyValueStore` row for a given key, if it exists.
 *
 * At most one document should exist per `key`; callers use this for config and
 * tooling reads (including `getProductionVersionTagValue`).
 *
 * @param ctx - Convex query or mutation context
 * @param key - Logical config key stored in the `key` field
 * @returns The matching row, or `null` if no document exists for `key`
 */
export const fetchEntryByKey = async (
  ctx: QueryCtx | MutationCtx,
  key: string
) =>
  await ctx.db
    .query("keyValueStore")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();

/**
 * Inserts or replaces one `keyValueStore` row for a key.
 *
 * When a row exists, replaces it in place; otherwise inserts. `updatedAtMs`
 * defaults to `Date.now()` so callers can align timestamps across related writes.
 *
 * @param ctx - Convex mutation context
 * @param key - Document key
 * @param value - Stored value (string, number, boolean, or null)
 * @param updatedAtMs - Epoch ms for `updatedAt` (defaults to now)
 * @returns Resolves with no value when the insert or replace has finished
 */
export const upsertByKey = async (
  ctx: MutationCtx,
  key: string,
  value: KeyValueStore["value"],
  updatedAtMs?: number
): Promise<void> => {
  const existing = await fetchEntryByKey(ctx, key);
  const updatedAt = updatedAtMs ?? Date.now();
  const doc: KeyValueStore = { key, value, updatedAt };

  if (existing) {
    await ctx.db.replace(existing._id, doc);
  } else {
    await ctx.db.insert("keyValueStore", doc);
  }
};

/**
 * Reads the active ML production version tag from `keyValueStore`.
 *
 * Uses `KEY_PRODUCTION_VERSION_TAG`; coerces stored value to string or returns
 * `null` when the key is absent so prediction queries can short-circuit safely.
 *
 * @param ctx - Convex query or mutation context
 * @returns Production version tag string, or `null` when unset
 */
export const getProductionVersionTagValue = async (
  ctx: QueryCtx | MutationCtx
): Promise<string | null> => {
  const entry = await fetchEntryByKey(ctx, KEY_PRODUCTION_VERSION_TAG);
  return (entry?.value as string | null) ?? null;
};
