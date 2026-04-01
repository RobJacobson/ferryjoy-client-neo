/**
 * Internal mutations for the derived terminals topology rows.
 */

import type { Doc } from "_generated/dataModel";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { terminalTopologySchema } from "./schemas";

/**
 * Replace the backend terminals topology rows.
 *
 * @param ctx - Convex internal mutation context
 * @param args.rows - Derived terminals topology rows
 * @returns `null`
 */
export const replaceBackendTerminalsTopology = internalMutation({
  args: {
    rows: v.array(terminalTopologySchema),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("terminalsTopology").collect();
    const existingByAbbrev = new Map<string, Doc<"terminalsTopology">>(
      existing.map((row) => [row.TerminalAbbrev, row])
    );
    const nextAbbrevs = new Set(args.rows.map((row) => row.TerminalAbbrev));

    for (const row of args.rows) {
      const current = existingByAbbrev.get(row.TerminalAbbrev);

      if (current) {
        await ctx.db.replace(current._id, row);
      } else {
        await ctx.db.insert("terminalsTopology", row);
      }
    }

    for (const row of existing) {
      if (!nextAbbrevs.has(row.TerminalAbbrev)) {
        await ctx.db.delete(row._id);
      }
    }

    return null;
  },
});
