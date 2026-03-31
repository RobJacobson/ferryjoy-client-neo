import type { Doc } from "_generated/dataModel";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { type Terminal, terminalSchema } from "./schemas";

/**
 * Upsert the backend terminal snapshot with the latest upstream data.
 *
 * Existing rows are replaced in place when the TerminalAbbrev matches, new
 * rows are inserted, and rows missing from the incoming snapshot are preserved.
 *
 * @param ctx - Convex internal mutation context
 * @param args.terminals - Backend terminal snapshot rows from WSF locations
 */
export const replaceBackendTerminals = internalMutation({
  args: {
    terminals: v.array(terminalSchema),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("terminals").collect();
    const { toInsert, toReplace } = buildBackendTerminalUpsertOperations(
      existing,
      args.terminals
    );

    for (const {
      existing: existingTerminal,
      incoming: terminal,
    } of toReplace) {
      await ctx.db.replace(existingTerminal._id, terminal);
    }

    for (const terminal of toInsert) {
      await ctx.db.insert("terminals", terminal);
    }
  },
});

/**
 * Build the abbreviation-keyed terminal upsert operations for one incoming snapshot.
 *
 * @param existing - Existing backend terminals
 * @param incoming - Incoming backend terminal snapshot
 * @returns Insert and replace operations without any delete step
 */
export const buildBackendTerminalUpsertOperations = (
  existing: Array<Doc<"terminals">>,
  incoming: Array<Terminal>
) => {
  const existingByTerminalAbbrev = new Map<string, Doc<"terminals">>(
    existing.map((terminal) => [terminal.TerminalAbbrev, terminal])
  );
  const toInsert: Array<Terminal> = [];
  const toReplace: Array<{
    existing: Doc<"terminals">;
    incoming: Terminal;
  }> = [];

  for (const terminal of incoming) {
    const existingTerminal = existingByTerminalAbbrev.get(
      terminal.TerminalAbbrev
    );

    if (existingTerminal) {
      toReplace.push({ existing: existingTerminal, incoming: terminal });
      continue;
    }

    toInsert.push(terminal);
  }

  return {
    toInsert,
    toReplace,
  };
};
