/**
 * Convex action entrypoints for backend terminal sync.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { action, internalAction } from "_generated/server";
import { fetchWsfTerminalIdentities } from "adapters";
import { v } from "convex/values";
import type { TerminalIdentity } from "./schemas";

/**
 * Internal cron entry for refreshing backend terminal identity rows.
 *
 * Fetches WSF terminal basics and replaces `terminalsIdentity` with concise
 * identity fields only (no schedules or topology).
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
 * Public action for manual terminal repopulation and dev bootstrap.
 *
 * Mirrors `syncBackendTerminals` but is callable from the CLI; internal actions
 * cannot be run with `bunx convex run`.
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
 * Loads `terminalsIdentity` for one action tick (identity fields only).
 *
 * When the table is empty, runs `syncBackendTerminalTable` once so orchestrator
 * and adapters do not block on the hourly cron before first use.
 *
 * @param ctx - Convex action context for database operations
 * @returns Terminal identity rows for the current action
 */
export async function loadTerminalIdentities(
  ctx: ActionCtx
): Promise<Array<TerminalIdentity>> {
  let terminals: Array<TerminalIdentity> = await ctx.runQuery(
    internal.functions.terminals.queries.getAllTerminalIdentities
  );

  if (terminals.length > 0) {
    return terminals;
  }

  await syncBackendTerminalTable(ctx);

  terminals = await ctx.runQuery(
    internal.functions.terminals.queries.getAllTerminalIdentities
  );

  if (terminals.length === 0) {
    throw new Error(
      "Backend terminalsIdentity table is still empty after bootstrap refresh."
    );
  }

  return terminals;
}

/**
 * Fetches WSF terminal basics and replaces the `terminalsIdentity` snapshot.
 *
 * Shared by `syncBackendTerminals`, `runSyncBackendTerminals`, and
 * `loadTerminalIdentities` so every entrypoint applies the same adapter + mutation.
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
