/**
 * Convex schema and types for canonical terminal identity records.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";

export const terminalIdentitySchema = v.object({
  TerminalID: v.number(),
  TerminalName: v.string(),
  TerminalAbbrev: v.string(),
  IsPassengerTerminal: v.optional(v.boolean()),
  Latitude: v.optional(v.number()),
  Longitude: v.optional(v.number()),
  UpdatedAt: v.optional(v.number()),
});

export type TerminalIdentity = Infer<typeof terminalIdentitySchema>;
