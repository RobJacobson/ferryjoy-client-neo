import { internalQuery } from "_generated/server";
import { v } from "convex/values";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import { resolveTerminal, type TerminalSelector } from "./resolver";
import { terminalSchema } from "./schemas";

const terminalSelectorSchema = v.union(
  v.object({
    TerminalAbbrev: v.string(),
  }),
  v.object({
    TerminalID: v.number(),
  }),
  v.object({
    TerminalName: v.string(),
  })
);

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
 * Resolve a single terminal from the backend terminal table using one selector
 * field.
 *
 * @param ctx - Convex internal query context
 * @param args.selector - Exactly one terminal selector field
 * @returns Matching terminal, or `null` when not found
 */
export const resolveBackendTerminalInternal = internalQuery({
  args: {
    selector: terminalSelectorSchema,
  },
  returns: v.union(terminalSchema, v.null()),
  handler: async (ctx, args) => {
    const terminals = await ctx.db.query("terminals").collect();
    const strippedTerminals = terminals.map(stripConvexMeta);
    const selector = args.selector as TerminalSelector;

    return resolveTerminal(selector, strippedTerminals) ?? null;
  },
});
