/**
 * Convex action entrypoints for backend terminal sync.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { action, internalAction } from "_generated/server";
import { fetchWsfTerminalIdentities } from "adapters/wsf";
import { v } from "convex/values";
import type { TerminalIdentity } from "./schemas";

/**
 * Internal cron entry: fetch WSF terminal basics and replace the backend
 * `terminalsIdentity` snapshot.
 *
 * @param ctx - Convex internal action context
 * @returns `null` after the backend snapshot refresh completes
 */
export const syncBackendTerminals = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await syncBackendTerminalTable(ctx);
    return null;
  },
});

/**
 * Public entry for `bunx convex run`, `convex:repopulate-terminals`, and dev
 * bootstrap. Internal actions are not runnable from the CLI.
 *
 * @param ctx - Convex public action context
 * @returns `null` after the backend snapshot refresh completes
 */
export const runSyncBackendTerminals = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await syncBackendTerminalTable(ctx);
    return null;
  },
});

/**
 * Load the backend terminal snapshot for one action tick.
 *
 * If the table is empty, bootstrap it immediately from WSF basics so callers
 * do not need to wait for the hourly refresh cron.
 *
 * @param ctx - Convex action context for database operations
 * @returns Backend terminals for the current action
 */
export async function loadTerminalIdentities(
  ctx: ActionCtx
): Promise<Array<TerminalIdentity>> {
  let terminals: Array<TerminalIdentity> = await ctx.runQuery(
    internal.functions.terminals.queries.getAllBackendTerminalsInternal
  );

  if (terminals.length > 0) {
    return terminals;
  }

  await syncBackendTerminalTable(ctx);

  terminals = await ctx.runQuery(
    internal.functions.terminals.queries.getAllBackendTerminalsInternal
  );

  if (terminals.length === 0) {
    throw new Error(
      "Backend terminalsIdentity table is still empty after bootstrap refresh."
    );
  }

  return terminals;
}

/**
 * Fetch WSF terminal basics and replace the backend `terminalsIdentity` snapshot.
 *
 * Shared by {@link syncBackendTerminals}, {@link runSyncBackendTerminals},
 * {@link loadTerminalIdentities}, and orchestrator bootstrap.
 *
 * @param ctx - Convex action context
 * @returns `undefined` after the backend snapshot is fully replaced
 */
export async function syncBackendTerminalTable(ctx: ActionCtx): Promise<void> {
  const updatedAt = Date.now();
  const terminals = await fetchWsfTerminalIdentities(updatedAt);

  await ctx.runMutation(
    internal.functions.terminals.mutations.replaceBackendTerminals,
    {
      terminals,
    }
  );
}
