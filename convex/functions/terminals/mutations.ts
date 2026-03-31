import type { Doc } from "_generated/dataModel";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { terminalSchema } from "./schemas";

/**
 * Replace the backend terminal snapshot with the latest upstream data.
 *
 * Existing rows are replaced in place when the TerminalID matches, new rows
 * are inserted, and rows missing from the incoming snapshot are deleted.
 *
 * @param ctx - Convex internal mutation context
 * @param args.terminals - Full backend terminal snapshot from WSF basics
 * @returns Summary of rows inserted, replaced, and deleted
 */
export const replaceBackendTerminals = internalMutation({
  args: {
    terminals: v.array(terminalSchema),
  },
  returns: v.object({
    inserted: v.number(),
    replaced: v.number(),
    deleted: v.number(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("terminals").collect();
    const existingByTerminalId = new Map<number, Doc<"terminals">>(
      existing.map((terminal) => [terminal.TerminalID, terminal])
    );
    const incomingTerminalIds = new Set<number>();

    let inserted = 0;
    let replaced = 0;

    for (const terminal of args.terminals) {
      incomingTerminalIds.add(terminal.TerminalID);

      const existingTerminal = existingByTerminalId.get(terminal.TerminalID);

      if (existingTerminal) {
        await ctx.db.replace(existingTerminal._id, terminal);
        replaced += 1;
        continue;
      }

      await ctx.db.insert("terminals", terminal);
      inserted += 1;
    }

    let deleted = 0;

    for (const existingTerminal of existing) {
      if (incomingTerminalIds.has(existingTerminal.TerminalID)) {
        continue;
      }

      await ctx.db.delete(existingTerminal._id);
      deleted += 1;
    }

    return {
      inserted,
      replaced,
      deleted,
    };
  },
});
