/**
 * Public and internal queries for the `keyValueStore` table. The public
 * `getProductionVersionTag` query exposes read-only config to the app; internal
 * `getEntryByKey` returns full documents for actions and other backend callers
 * that need row identity.
 */

import { internalQuery, query } from "_generated/server";
import { v } from "convex/values";
import { fetchEntryByKey, getProductionVersionTagValue } from "./helpers";
import { keyValueStoreDocValidator } from "./schemas";

/**
 * Returns the active ML production version tag for clients.
 *
 * Reads `KEY_PRODUCTION_VERSION_TAG` via `getProductionVersionTagValue` so the
 * client and prediction code share one definition of the active model tag.
 *
 * @param ctx - Convex query context
 * @returns The version tag string, or `null` when the key is not set
 */
export const getProductionVersionTag = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => await getProductionVersionTagValue(ctx),
});

/**
 * Returns one `keyValueStore` document by key for internal callers.
 *
 * Exposes the full row (including `_id`) for actions that must reference the
 * document identity. Mutations already run in a write transaction and should call
 * `fetchEntryByKey` directly instead of scheduling this query.
 *
 * @param ctx - Convex query context
 * @param args.key - Key to resolve
 * @returns The full document, or `null` when no row exists for `key`
 */
export const getEntryByKey = internalQuery({
  args: { key: v.string() },
  returns: v.union(keyValueStoreDocValidator, v.null()),
  handler: async (ctx, args) => await fetchEntryByKey(ctx, args.key),
});
