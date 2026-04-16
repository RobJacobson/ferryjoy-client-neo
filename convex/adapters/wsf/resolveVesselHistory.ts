/**
 * Resolves WSF vessel-history rows against backend vessel and terminal
 * snapshots.
 */

import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import {
  resolveTerminalByAbbrev,
  resolveTerminalByName,
  type TerminalIdentity,
} from "./resolveTerminal";
import { resolveVessel, type VesselIdentity } from "./resolveVessel";

type ResolvedVesselHistory = {
  vessel: VesselIdentity;
  departingTerminal: TerminalIdentity;
  arrivingTerminal: TerminalIdentity;
};

const HISTORY_TERMINAL_ABBREV_ALIASES: Record<string, string> = {
  Colman: "P52",
  Keystone: "COU",
  Vashon: "VAI",
};

/**
 * Resolves the backend vessel and terminal rows for a WSF vessel-history row.
 *
 * @param record - Raw WSF vessel-history row
 * @param vessels - Backend vessel identity rows
 * @param terminals - Backend terminal identity rows
 * @returns Resolved vessel and terminal rows, or `null` when any are unknown
 */
export const resolveVesselHistory = (
  record: VesselHistory,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): ResolvedVesselHistory | null => {
  const vessel = resolveVessel(
    record.Vessel ? String(record.Vessel) : "",
    vessels
  );
  const departingTerminal = resolveHistoryTerminal(
    record.Departing ?? "",
    terminals
  );
  const arrivingTerminal = resolveHistoryTerminal(
    record.Arriving ?? "",
    terminals
  );

  if (!vessel || !departingTerminal || !arrivingTerminal) {
    return null;
  }

  return {
    vessel,
    departingTerminal,
    arrivingTerminal,
  };
};

/**
 * Resolves a backend terminal row from a WSF vessel-history terminal field.
 *
 * @param terminalName - Raw terminal identifier from WSF history
 * @param terminals - Backend terminal identity rows
 * @returns Matching terminal row, or `null` when not found
 */
const resolveHistoryTerminal = (
  terminalName: string,
  terminals: ReadonlyArray<TerminalIdentity>
): TerminalIdentity | null => {
  const normalized = terminalName.trim();

  if (!normalized) {
    return null;
  }

  const exactMatch = resolveTerminalByName(normalized, terminals);

  if (exactMatch) {
    return exactMatch;
  }

  const aliasAbbrev = HISTORY_TERMINAL_ABBREV_ALIASES[normalized];

  return aliasAbbrev ? resolveTerminalByAbbrev(aliasAbbrev, terminals) : null;
};
