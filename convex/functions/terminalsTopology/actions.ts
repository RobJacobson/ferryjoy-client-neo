/**
 * Convex action entrypoints for derived terminals topology sync.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { action, internalAction } from "_generated/server";
import { buildWsfTerminalsTopology } from "adapters/wsf";
import { v } from "convex/values";
import { getSailingDay } from "../../shared/time";
import {
  loadTerminalIdentities,
  syncBackendTerminalTable,
} from "../terminalIdentities/actions";
import type { TerminalIdentity } from "../terminalIdentities/schemas";
import type { TerminalTopology } from "./schemas";

/**
 * Refresh the backend terminals topology snapshot from WSF schedule data.
 *
 * @param ctx - Convex internal action context
 * @returns `null`
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
 * Public entry point for manual refreshes and local scripts.
 *
 * @param ctx - Convex public action context
 * @returns `null`
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
 * Load the backend terminals topology snapshot for one action tick.
 *
 * @param ctx - Convex action context
 * @returns Snapshot for the current action
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
 * Shared implementation for topology refresh.
 *
 * @param ctx - Convex action context
 * @returns When the snapshot is refreshed
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
 * Ensure backend terminals exist before topology derivation runs.
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
 * Normalize unknown thrown values into an Error.
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
