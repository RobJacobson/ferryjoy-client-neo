/**
 * Convex action entrypoints for backend vessel sync.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { action, internalAction } from "_generated/server";
import { fetchWsfVesselIdentities } from "adapters";
import { v } from "convex/values";
import type { VesselIdentity } from "./schemas";

/**
 * Internal cron entry for refreshing backend vessel identity rows.
 *
 * Fetches WSF vessel basics and replaces `vesselsIdentity` (no live locations or
 * trips—those live in other tables).
 *
 * @param ctx - Convex internal action context
 * @returns `null` after the backend snapshot refresh completes
 */
export const syncBackendVessels = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await syncBackendVesselTable(ctx);
    return null;
  },
});

/**
 * Public action for manual vessel repopulation and dev bootstrap.
 *
 * Mirrors `syncBackendVessels` for CLI use; internal actions are not invokable
 * via `bunx convex run`.
 *
 * @param ctx - Convex public action context
 * @returns `null` after the backend snapshot refresh completes
 */
export const runSyncBackendVessels = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await syncBackendVesselTable(ctx);
    return null;
  },
});

/**
 * Loads `vesselsIdentity` for one action tick (identity fields only).
 *
 * When empty, runs `syncBackendVesselTable` once so orchestration does not stall
 * before the scheduled cron fills the table.
 *
 * @param ctx - Convex action context for database operations
 * @returns Vessel identity rows for the current action
 */
export async function loadVesselIdentities(
  ctx: ActionCtx
): Promise<Array<VesselIdentity>> {
  let vessels: Array<VesselIdentity> = await ctx.runQuery(
    internal.functions.vesselLocation.queries.getAllVesselIdentities
  );

  if (vessels.length > 0) {
    return vessels;
  }

  await syncBackendVesselTable(ctx);

  vessels = await ctx.runQuery(
    internal.functions.vesselLocation.queries.getAllVesselIdentities
  );

  if (vessels.length === 0) {
    throw new Error(
      "Backend vesselsIdentity table is still empty after bootstrap refresh."
    );
  }

  return vessels;
}

/**
 * Fetches WSF vessel basics and replaces the `vesselsIdentity` snapshot.
 *
 * Shared by `syncBackendVessels`, `runSyncBackendVessels`, and
 * `loadVesselIdentities` for a single adapter + mutation path.
 *
 * @param ctx - Convex action context
 * @returns `undefined` after the backend snapshot is fully replaced
 */
export async function syncBackendVesselTable(ctx: ActionCtx): Promise<void> {
  const vessels = await fetchWsfVesselIdentities();

  await ctx.runMutation(
    internal.functions.vesselLocation.mutations.replaceBackendVessels,
    {
      vessels,
    }
  );
}
