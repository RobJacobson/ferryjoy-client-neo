/**
 * Convex schema and types for canonical terminal identity records.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";

export const terminalSchema = v.object({
  TerminalID: v.number(),
  TerminalName: v.string(),
  TerminalAbbrev: v.string(),
  UpdatedAt: v.optional(v.number()),
});

export type Terminal = Infer<typeof terminalSchema>;
