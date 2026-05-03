/**
 * Query handlers for `terminalsIdentity` (concise terminal identity rows) and
 * public frontend snapshots — not full terminal operational or schedule data.
 */

import { internalQuery, query } from "_generated/server";
import { v } from "convex/values";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import { terminalIdentitySchema } from "./schemas";

/**
 * Lists all `terminalsIdentity` rows (canonical identity fields only).
 *
 * Excludes schedules and derived topology; strips `_id` / `_creationTime` for
 * stable wire shapes in orchestrator snapshot loads.
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
 * Loads one `terminalsIdentity` row by `TerminalAbbrev`.
 *
 * Uses `by_terminal_abbrev` with `unique()` so duplicate-index bugs throw instead
 * of returning ambiguous data.
 *
 * @param ctx - Convex internal query context
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
 * Public snapshot of canonical terminal identity data for the app.
 *
 * Empty table returns `null`, not `[]`: `useLayeredDataset` only applies Convex
 * when `convexData` is an array, so `null` preserves bundled assets and KV cache;
 * `[]` would overwrite them as “authoritative.” Falsy also fails asset generation.
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
