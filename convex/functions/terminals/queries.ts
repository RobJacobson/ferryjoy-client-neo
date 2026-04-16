/**
 * Query handlers for backend and frontend terminal identity snapshots.
 */

import { internalQuery, query } from "_generated/server";
import { v } from "convex/values";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import { terminalSchema } from "./schemas";

/**
 * Fetch all backend terminal rows.
 *
 * @param ctx - Convex internal query context
 * @returns Backend terminal rows without Convex metadata
 */
export const getAllBackendTerminalsInternal = internalQuery({
  args: {},
  returns: v.array(terminalSchema),
  handler: async (ctx) => {
    const terminals = await ctx.db.query("terminals").collect();
    return terminals.map(stripConvexMeta);
  },
});

/**
 * Public frontend snapshot query for canonical terminal identity data.
 *
 * @param ctx - Convex public query context
 * @returns Terminal snapshot rows without Convex metadata, or `null` when empty
 */
export const getFrontendTerminalsSnapshot = query({
  args: {},
  returns: v.union(v.array(terminalSchema), v.null()),
  handler: async (ctx) => {
    const terminals = await ctx.db.query("terminals").collect();

    if (terminals.length === 0) {
      return null;
    }

    return terminals.map(stripConvexMeta);
  },
});
