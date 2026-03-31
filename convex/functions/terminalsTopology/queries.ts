/**
 * Public and internal queries for the derived terminals topology rows.
 */

import { internalQuery, query } from "_generated/server";
import { v } from "convex/values";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import { terminalTopologySchema } from "./schemas";

/**
 * Fetch all backend terminals topology rows for internal callers.
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
 * Public frontend snapshot query for the terminals topology dataset.
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
