import {
  resolveTerminal,
  type TerminalIdentity,
} from "../functions/terminals/resolver";
import type { RawWsfScheduleSegment } from "./fetchWsfScheduleData";
import type { TerminalAbbrev, VesselAbbrev } from "./identity";
import { resolveVesselAbbrev, type VesselIdentity } from "./vessels";

type ResolvedScheduleSegmentIdentity = {
  vesselAbbrev: VesselAbbrev;
  departingTerminalAbbrev: TerminalAbbrev;
  arrivingTerminalAbbrev: TerminalAbbrev;
};

const HISTORY_TERMINAL_ABBREV_ALIASES: Record<string, string> = {
  Colman: "P52",
  Keystone: "COU",
  Vashon: "VAI",
};

type TerminalLookupInput = {
  TerminalAbbrev?: string | null;
  TerminalID?: number | null;
  TerminalName?: string | null;
};

/**
 * Resolve the required backend identity fields for a raw WSF schedule segment.
 *
 * @param segment - Raw schedule segment from WSF
 * @param vessels - Backend vessel identity rows
 * @param terminals - Backend terminal identity rows
 * @returns Resolved abbreviations, or `null` when any required field is unknown
 */
export const resolveScheduleSegmentIdentity = (
  segment: RawWsfScheduleSegment,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): ResolvedScheduleSegmentIdentity | null => {
  const vesselAbbrev = resolveVesselAbbrev(segment.VesselName, vessels);
  const departingTerminalAbbrev = resolveScheduleTerminalAbbrev(
    segment.DepartingTerminalName,
    terminals
  );
  const arrivingTerminalAbbrev = resolveScheduleTerminalAbbrev(
    segment.ArrivingTerminalName,
    terminals
  );

  if (!vesselAbbrev || !departingTerminalAbbrev || !arrivingTerminalAbbrev) {
    return null;
  }

  return {
    vesselAbbrev,
    departingTerminalAbbrev,
    arrivingTerminalAbbrev,
  };
};

/**
 * Resolve a terminal abbreviation from the schedule API.
 *
 * The schedule pipeline currently exposes WSF terminal names, not terminal IDs,
 * so this intentionally relies on exact backend `TerminalName` matches only.
 *
 * @param terminalName - Raw terminal name from WSF schedule data
 * @param terminals - Backend terminal identity rows
 * @returns Resolved terminal abbreviation, or `null` when unknown
 */
export const resolveScheduleTerminalAbbrev = (
  terminalName: string,
  terminals: ReadonlyArray<TerminalIdentity>
): TerminalAbbrev | null =>
  resolveTerminalAbbrev({ TerminalName: terminalName }, terminals);

/**
 * Resolve a terminal abbreviation from the vessel-history API.
 *
 * Prefer exact backend identifiers first. If history sends one of a small set
 * of known alternative names, use the explicit alias table rather than fuzzy
 * string normalization.
 *
 * @param terminalName - Raw terminal identifier from WSF history
 * @param terminals - Backend terminal identity rows
 * @returns Resolved terminal abbreviation, or `null` when unknown
 */
export const resolveHistoryTerminalAbbrev = (
  terminalName: string,
  terminals: ReadonlyArray<TerminalIdentity>
): TerminalAbbrev | null => {
  const exactMatch = resolveTerminalAbbrev(
    { TerminalName: terminalName },
    terminals
  );

  if (exactMatch) {
    return exactMatch;
  }

  const aliasAbbrev = HISTORY_TERMINAL_ABBREV_ALIASES[terminalName.trim()];

  return aliasAbbrev
    ? resolveTerminalAbbrev({ TerminalAbbrev: aliasAbbrev }, terminals)
    : null;
};

/**
 * Resolve a terminal abbreviation from trusted terminal identifiers.
 *
 * This prefers abbreviation, then ID, then exact name. It does not perform
 * fuzzy normalization.
 *
 * @param input - Candidate terminal identifiers from a specific source
 * @param terminals - Backend terminal identity rows
 * @returns Resolved terminal abbreviation, or `null` when unknown
 */
export const resolveTerminalAbbrev = (
  input: TerminalLookupInput,
  terminals: ReadonlyArray<TerminalIdentity>
): TerminalAbbrev | null => {
  const terminalAbbrev = input.TerminalAbbrev?.trim();

  if (terminalAbbrev) {
    return (
      resolveTerminal({ TerminalAbbrev: terminalAbbrev }, terminals)
        ?.TerminalAbbrev ?? null
    );
  }

  if (input.TerminalID !== null && input.TerminalID !== undefined) {
    return (
      resolveTerminal({ TerminalID: input.TerminalID }, terminals)
        ?.TerminalAbbrev ?? null
    );
  }

  const terminalName = input.TerminalName?.trim();

  return terminalName
    ? (resolveTerminal({ TerminalName: terminalName }, terminals)
        ?.TerminalAbbrev ?? null)
    : null;
};
