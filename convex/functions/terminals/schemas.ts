/**
 * Convex schema and types for canonical terminal identity records.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import type { TerminalAbbrev, TerminalName } from "../../shared/identity";

export const terminalSchema = v.object({
  TerminalID: v.number(),
  TerminalName: v.string(),
  TerminalAbbrev: v.string(),
  IsPassengerTerminal: v.optional(v.boolean()),
  Latitude: v.optional(v.number()),
  Longitude: v.optional(v.number()),
  UpdatedAt: v.optional(v.number()),
});

export type Terminal = Infer<typeof terminalSchema>;

export type ResolvedTerminalRecord = Omit<
  Terminal,
  "TerminalName" | "TerminalAbbrev"
> & {
  TerminalName: TerminalName;
  TerminalAbbrev: TerminalAbbrev;
};
