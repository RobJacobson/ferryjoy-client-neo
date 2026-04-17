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
 * Internal cron entry: fetch WSF vessel basics and replace the backend
 * `vessels` snapshot.
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
 * Public entry for `bunx convex run`, `convex:repopulate-vessels`, and
 * `convex:dev:with-repopulate`. Internal actions are not runnable from the CLI.
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
 * Load the backend vessel snapshot for one action tick.
 *
 * If the table is empty, bootstrap it immediately from WSF basics so callers
 * do not need to wait for the hourly refresh cron.
 *
 * @param ctx - Convex action context for database operations
 * @returns Backend vessels for the current action
 */
export async function loadVesselIdentities(
  ctx: ActionCtx
): Promise<Array<VesselIdentity>> {
  let vessels: Array<VesselIdentity> = await ctx.runQuery(
    internal.functions.vesselLocation.queries.getAllBackendVesselsInternal
  );

  if (vessels.length > 0) {
    return vessels;
  }

  await syncBackendVesselTable(ctx);

  vessels = await ctx.runQuery(
    internal.functions.vesselLocation.queries.getAllBackendVesselsInternal
  );

  if (vessels.length === 0) {
    throw new Error(
      "Backend vesselsIdentity table is still empty after bootstrap refresh."
    );
  }

  return vessels;
}

/**
 * Fetch WSF vessel basics and replace the backend `vesselsIdentity` snapshot.
 *
 * Shared by {@link syncBackendVessels}, {@link runSyncBackendVessels},
 * {@link loadVesselIdentities}, and orchestrator bootstrap.
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
