/**
 * Shared terminal selector and resolver utilities for the backend terminals
 * table.
 */

export type TerminalIdentity = {
  TerminalID: number;
  TerminalName: string;
  TerminalAbbrev: string;
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
): TerminalIdentity | null => {
  if ("TerminalAbbrev" in selector) {
    return (
      terminals.find(
        (terminal) => terminal.TerminalAbbrev === selector.TerminalAbbrev
      ) ?? null
    );
  }

  if ("TerminalID" in selector) {
    return (
      terminals.find(
        (terminal) => terminal.TerminalID === selector.TerminalID
      ) ?? null
    );
  }

  return (
    terminals.find(
      (terminal) => terminal.TerminalName === selector.TerminalName
    ) ?? null
  );
};
