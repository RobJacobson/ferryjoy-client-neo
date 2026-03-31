/**
 * Convex schema and types for the derived terminals topology rows.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";

export const terminalTopologySchema = v.object({
  TerminalAbbrev: v.string(),
  TerminalMates: v.array(v.string()),
  RouteAbbrevs: v.array(v.string()),
  RouteAbbrevsByArrivingTerminal: v.record(v.string(), v.array(v.string())),
  UpdatedAt: v.optional(v.number()),
});

export type TerminalTopology = Infer<typeof terminalTopologySchema>;
