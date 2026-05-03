/**
 * Shared database helpers for the keyValueStore table (queries and mutations).
 */

import type { MutationCtx, QueryCtx } from "_generated/server";
import { KEY_PRODUCTION_VERSION_TAG, type KeyValueStore } from "./schemas";

/**
 * Loads a single `keyValueStore` document by string key.
 *
 * Uses the `by_key` index for O(1) lookups shared by mutations, queries, and
 * config helpers such as `getProductionVersionTagValue`.
 *
 * @param ctx - Convex query or mutation context
 * @param key - Document key
 * @returns The matching row, or `null` if missing
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
 * When a row exists, replaces in place; otherwise inserts. `updatedAtMs` defaults
 * to `Date.now()` so callers can align clocks across related writes.
 *
 * @param ctx - Convex mutation context
 * @param key - Document key
 * @param value - Stored value (string, number, boolean, or null)
 * @param updatedAtMs - Epoch ms for `updatedAt` (defaults to now)
 * @returns `undefined` after the matching row is inserted or replaced
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
