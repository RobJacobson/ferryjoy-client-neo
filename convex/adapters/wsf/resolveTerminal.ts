/**
 * WSF-facing terminal lookup helpers against backend terminal snapshots.
 */

import type { TerminalIdentity } from "functions/terminalIdentities/schemas";

/**
 * Resolves a terminal by its backend abbreviation.
 *
 * @param terminalAbbrev - Canonical terminal abbreviation
 * @param terminals - Backend terminal rows to search
 * @returns Matching terminal row, or `null` when not found
 */
export const resolveTerminalByAbbrev = (
  terminalAbbrev: string,
  terminals: ReadonlyArray<TerminalIdentity>
): TerminalIdentity | null =>
  terminals.find((terminal) => terminal.TerminalAbbrev === terminalAbbrev) ??
  null;

/**
 * Resolves a terminal by its backend numeric identifier.
 *
 * @param terminalId - Backend terminal identifier
 * @param terminals - Backend terminal rows to search
 * @returns Matching terminal row, or `null` when not found
 */
export const resolveTerminalById = (
  terminalId: number,
  terminals: ReadonlyArray<TerminalIdentity>
): TerminalIdentity | null =>
  terminals.find((terminal) => terminal.TerminalID === terminalId) ?? null;

/**
 * Resolves a terminal by its exact backend terminal name.
 *
 * @param terminalName - Canonical backend terminal name
 * @param terminals - Backend terminal rows to search
 * @returns Matching terminal row, or `null` when not found
 */
export const resolveTerminalByName = (
  terminalName: string,
  terminals: ReadonlyArray<TerminalIdentity>
): TerminalIdentity | null =>
  terminals.find((terminal) => terminal.TerminalName === terminalName) ?? null;
