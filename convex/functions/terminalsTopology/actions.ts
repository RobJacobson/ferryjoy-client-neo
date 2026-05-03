/**
 * Convex action entrypoints for derived terminals topology sync.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { action, internalAction } from "_generated/server";
import { buildWsfTerminalsTopology } from "adapters";
import { v } from "convex/values";
import { getSailingDay } from "../../shared/time";
import {
  loadTerminalIdentities,
  syncBackendTerminalTable,
} from "../terminals/actions";
import type { TerminalIdentity } from "../terminals/schemas";
import type { TerminalTopology } from "./schemas";

/**
 * Refreshes derived `terminalsTopology` rows from WSF schedule inputs.
 *
 * Delegates to `refreshBackendTerminalsTopologyImpl`, which ensures terminals
 * exist, builds topology via adapter, and replaces the table in one mutation.
 *
 * @param ctx - Convex internal action context
 * @returns `null` after refresh completes
 */
export const refreshBackendTerminalsTopology = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await refreshBackendTerminalsTopologyImpl(ctx);
    return null;
  },
});

/**
 * Public action for manual topology refresh and local scripts.
 *
 * Same implementation as the internal refresh; exposed for `bunx convex run`.
 *
 * @param ctx - Convex public action context
 * @returns `null` after refresh completes
 */
export const runRefreshBackendTerminalsTopology = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await refreshBackendTerminalsTopologyImpl(ctx);
    return null;
  },
});

/**
 * Loads `terminalsTopology` for one action tick or bootstraps it when empty.
 *
 * When no rows exist, runs a refresh then re-reads; throws if still empty so
 * callers fail fast on persistent setup issues.
 *
 * @param ctx - Convex action context
 * @returns Topology rows for the current action
 */
export const loadBackendTerminalsTopologyOrThrow = async (
  ctx: ActionCtx
): Promise<Array<TerminalTopology>> => {
  let rows = await ctx.runQuery(
    internal.functions.terminalsTopology.queries
      .getBackendTerminalsTopologyInternal
  );

  if (rows.length > 0) {
    return rows;
  }

  await refreshBackendTerminalsTopologyImpl(ctx);

  rows = await ctx.runQuery(
    internal.functions.terminalsTopology.queries
      .getBackendTerminalsTopologyInternal
  );

  if (rows.length === 0) {
    throw new Error(
      "Backend terminals topology rows are still missing after refresh."
    );
  }

  return rows;
};

/**
 * Shared implementation for terminals topology refresh.
 *
 * Builds rows for today’s Pacific sailing day, replaces the backend table, and
 * logs or rethrows normalized errors from the adapter chain.
 *
 * @param ctx - Convex action context
 * @returns Resolves when the snapshot mutation finishes
 */
const refreshBackendTerminalsTopologyImpl = async (
  ctx: ActionCtx
): Promise<void> => {
  try {
    const terminals = await ensureBackendTerminals(ctx);
    const tripDate = getSailingDay(new Date());
    const updatedAt = Date.now();
    const rows = await buildWsfTerminalsTopology(terminals, {
      tripDate,
      updatedAt,
    });

    await ctx.runMutation(
      internal.functions.terminalsTopology.mutations
        .replaceBackendTerminalsTopology,
      {
        rows,
      }
    );
  } catch (error) {
    const normalized = normalizeUnknownError(error);
    console.error("refreshBackendTerminalsTopology failed:", normalized);
    throw normalized;
  }
};

/**
 * Ensures `terminalsIdentity` is non-empty before topology derivation.
 *
 * Reloads after `syncBackendTerminalTable` when the first read returns no rows
 * so `buildWsfTerminalsTopology` always receives a full identity snapshot.
 *
 * @param ctx - Convex action context
 * @returns Canonical backend terminals
 */
const ensureBackendTerminals = async (
  ctx: ActionCtx
): Promise<Array<TerminalIdentity>> => {
  const terminals = await loadTerminalIdentities(ctx);

  if (terminals.length > 0) {
    return terminals;
  }

  await syncBackendTerminalTable(ctx);
  return await loadTerminalIdentities(ctx);
};

/**
 * Coerces unknown thrown values into an `Error` for consistent logging.
 *
 * Preserves existing `Error` instances; wraps primitives with `String(error)`.
 *
 * @param error - Unknown thrown value
 * @returns Normalized error instance
 */
const normalizeUnknownError = (error: unknown) => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : String(error));
};
