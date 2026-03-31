/**
 * Shared terminal selector and resolver utilities for the backend terminals
 * table.
 */

import {
  type TerminalAbbrev,
  type TerminalName,
  toTerminalAbbrev,
  toTerminalName,
} from "../../shared/identity";

export type TerminalIdentity = {
  TerminalID: number;
  TerminalName: string;
  TerminalAbbrev: string;
  IsPassengerTerminal?: boolean;
  Latitude?: number;
  Longitude?: number;
};

export type ResolvedTerminal = {
  TerminalID: number;
  TerminalName: TerminalName;
  TerminalAbbrev: TerminalAbbrev;
  IsPassengerTerminal?: boolean;
  Latitude?: number;
  Longitude?: number;
};

export type TerminalSelector =
  | { TerminalAbbrev: string }
  | { TerminalID: number }
  | { TerminalName: string };

/**
 * Resolve a terminal from the backend terminal identity snapshot.
 *
 * @param selector - Exactly one terminal identifier field to match
 * @param terminals - Backend terminal rows to search
 * @returns Matching terminal row, or `null` when not found
 */
export const resolveTerminal = (
  selector: TerminalSelector,
  terminals: ReadonlyArray<TerminalIdentity>
): ResolvedTerminal | null => {
  if ("TerminalAbbrev" in selector) {
    return toResolvedTerminal(
      terminals.find(
        (terminal) => terminal.TerminalAbbrev === selector.TerminalAbbrev
      ) ?? null
    );
  }

  if ("TerminalID" in selector) {
    return toResolvedTerminal(
      terminals.find(
        (terminal) => terminal.TerminalID === selector.TerminalID
      ) ?? null
    );
  }

  return toResolvedTerminal(
    terminals.find(
      (terminal) => terminal.TerminalName === selector.TerminalName
    ) ?? null
  );
};

/**
 * Convert a raw backend terminal row into the branded resolved form.
 *
 * @param terminal - Raw backend terminal row
 * @returns Branded resolved terminal, or `null` when no row was provided
 */
const toResolvedTerminal = (
  terminal: TerminalIdentity | null
): ResolvedTerminal | null =>
  terminal
    ? {
        TerminalID: terminal.TerminalID,
        TerminalName: toTerminalName(terminal.TerminalName),
        TerminalAbbrev: toTerminalAbbrev(terminal.TerminalAbbrev),
        IsPassengerTerminal: terminal.IsPassengerTerminal,
        Latitude: terminal.Latitude,
        Longitude: terminal.Longitude,
      }
    : null;
