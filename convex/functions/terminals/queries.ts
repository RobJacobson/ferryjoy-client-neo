/**
 * Query handlers for **`terminalsIdentity`** (concise terminal identity rows) and
 * public frontend snapshots — not full terminal operational or schedule data.
 */

import { internalQuery, query } from "_generated/server";
import { v } from "convex/values";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import { terminalIdentitySchema } from "./schemas";

/**
 * All rows from **`terminalsIdentity`**: canonical terminal identity fields only
 * (abbrev, names, geography, etc.), not schedules or derived topology.
 *
 * @param ctx - Convex internal query context
 * @returns Terminal identity rows without Convex metadata
 */
export const getAllTerminalIdentities = internalQuery({
  args: {},
  returns: v.array(terminalIdentitySchema),
  handler: async (ctx) => {
    const terminals = await ctx.db.query("terminalsIdentity").collect();
    return terminals.map(stripConvexMeta);
  },
});

/**
 * One **`terminalsIdentity`** row by abbreviation.
 *
 * @param args.terminalAbbrev - Terminal abbreviation to resolve
 * @returns Terminal identity row without Convex metadata, or `null`
 */
export const getBackendTerminalByAbbrevInternal = internalQuery({
  args: {
    terminalAbbrev: v.string(),
  },
  returns: v.union(terminalIdentitySchema, v.null()),
  handler: async (ctx, args) => {
    const terminal = await ctx.db
      .query("terminalsIdentity")
      .withIndex("by_terminal_abbrev", (q) =>
        q.eq("TerminalAbbrev", args.terminalAbbrev)
      )
      .unique();

    return terminal ? stripConvexMeta(terminal) : null;
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
  returns: v.union(v.array(terminalIdentitySchema), v.null()),
  handler: async (ctx) => {
    const terminals = await ctx.db.query("terminalsIdentity").collect();

    if (terminals.length === 0) {
      return null;
    }

    return terminals.map(stripConvexMeta);
  },
});
