/**
 * Mutation handlers for refreshing backend terminal snapshot rows.
 */

import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { terminalIdentitySchema } from "./schemas";

/**
 * Upsert terminal rows keyed by `TerminalAbbrev`. When a row already exists
 * for an abbreviation it is replaced; otherwise a new row is inserted. Rows
 * not included in the incoming batch are left unchanged.
 *
 * @param ctx - Convex internal mutation context
 * @param args - Incoming terminal snapshot rows
 * @returns `undefined` after upserts complete
 */
export const replaceBackendTerminals = internalMutation({
  args: {
    terminals: v.array(terminalIdentitySchema),
  },
  handler: async (ctx, args) => {
    // Get all existing terminal identities.
    const existing = await ctx.db.query("terminalsIdentity").collect();

    // Build a map of existing terminal identities by abbreviation.
    const byAbbrev = new Map(
      existing.map((row) => [row.TerminalAbbrev, row] as const)
    );

    // Upsert each terminal identity.
    for (const terminal of args.terminals) {
      const previous = byAbbrev.get(terminal.TerminalAbbrev);
      if (previous) {
        await ctx.db.replace(previous._id, terminal);
      } else {
        await ctx.db.insert("terminalsIdentity", terminal);
      }
    }
  },
});
