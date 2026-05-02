/**
 * Public and internal queries for the derived terminals topology rows.
 */

import { internalQuery, query } from "_generated/server";
import { v } from "convex/values";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import { terminalTopologySchema } from "./schemas";

/**
 * Lists all `terminalsTopology` rows for internal callers.
 *
 * Full collect with metadata stripped; used by actions during refresh and preload.
 *
 * @param ctx - Convex internal query context
 * @returns Rows without Convex metadata
 */
export const getBackendTerminalsTopologyInternal = internalQuery({
  args: {},
  returns: v.array(terminalTopologySchema),
  handler: async (ctx) => {
    const rows = await ctx.db.query("terminalsTopology").collect();
    return rows.map(stripConvexMeta);
  },
});

/**
 * Public snapshot of the terminals topology dataset for the app.
 *
 * Empty table returns `null`, not `[]` — same `useLayeredDataset` contract as
 * the other frontend identity snapshots.
 *
 * @param ctx - Convex public query context
 * @returns Rows without Convex metadata, or `null` when missing
 */
export const getFrontendTerminalsTopologySnapshot = query({
  args: {},
  returns: v.union(v.array(terminalTopologySchema), v.null()),
  handler: async (ctx) => {
    const rows = await ctx.db.query("terminalsTopology").collect();

    if (rows.length === 0) {
      return null;
    }

    return rows.map(stripConvexMeta);
  },
});
