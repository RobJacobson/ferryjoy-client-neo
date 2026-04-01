/**
 * Terminal identity + topology join helpers.
 */

import type { TerminalsTopologyDataContextValue } from "@/data/contexts/identity";
import type { Terminal } from "@/types";

export type TerminalWithMates = Readonly<
  Terminal & {
    TerminalMates: Array<string>;
  }
>;

type TerminalsTopologyByAbbrev =
  TerminalsTopologyDataContextValue["terminalsTopologyByAbbrev"];

/**
 * Join a canonical terminal row with topology mates for terminal-only map
 * navigation.
 *
 * The `/map/[slug]` rouRte uses `TerminalMates` to decide whether a terminal
 * should redirect to a single paired destination or stay in the "all terminals"
 * view. Other terminal fields come directly from the canonical identity row.
 *
 * @param terminalsTopologyByAbbrev - Topology rows indexed by terminal abbrev
 * @param terminal - Canonical terminal identity row
 * @returns Terminal row augmented with its mate abbreviations
 */
export const toTerminalWithMates = (
  terminalsTopologyByAbbrev: TerminalsTopologyByAbbrev,
  terminal: Terminal
): TerminalWithMates => ({
  ...terminal,
  TerminalMates:
    terminalsTopologyByAbbrev[terminal.TerminalAbbrev]?.TerminalMates ?? [],
});
