/**
 * Terminal identity and topology helpers backed by the shared frontend
 * identity catalog.
 */

import {
  type IdentityCatalogState,
  readIdentityCatalog,
} from "@/data/identity";

export type TerminalLocation = {
  TerminalID: number;
  TerminalName: string;
  TerminalAbbrev: string;
  Latitude?: number;
  Longitude?: number;
  routeAbbrevs: Array<string>;
  routeAbbrev: string | null;
  TerminalMates: Array<string>;
};

/**
 * Get terminal location data by abbreviation.
 *
 * @param terminalAbbrev - Terminal abbreviation
 * @returns Terminal location view model or `null`
 */
export const getTerminalLocationByAbbrev = (
  terminalAbbrev: string
): TerminalLocation | null => {
  const terminal =
    readIdentityCatalog().terminalsByAbbrev[terminalAbbrev.toUpperCase()];

  if (!terminal) {
    return null;
  }

  return toTerminalLocation(terminal);
};

/**
 * Get terminal display name by abbreviation.
 *
 * @param terminalAbbrev - Terminal abbreviation
 * @returns Terminal name or `null`
 */
export const getTerminalNameByAbbrev = (
  terminalAbbrev: string
): string | null =>
  readIdentityCatalog().terminalsByAbbrev[terminalAbbrev.toUpperCase()]
    ?.TerminalName ?? null;

/**
 * Get terminal location data by numeric terminal ID.
 *
 * @param terminalId - Terminal ID
 * @returns Terminal location view model or `null`
 */
export const getTerminalLocationById = (
  terminalId: number
): TerminalLocation | null => {
  const terminal = readIdentityCatalog().terminalsById[String(terminalId)];

  if (!terminal) {
    return null;
  }

  return toTerminalLocation(terminal);
};

/**
 * Get all terminals associated with one route abbreviation.
 *
 * @param routeAbbrev - Route abbreviation
 * @returns Matching terminal locations
 */
export const getTerminalsByRoute = (routeAbbrev: string): TerminalLocation[] =>
  readIdentityCatalog()
    .terminals.map((terminal) => toTerminalLocation(terminal))
    .filter((terminal) => terminal.routeAbbrevs.includes(routeAbbrev));

/**
 * Get all terminals in the current catalog.
 *
 * @returns All terminal location view models
 */
export const getAllTerminalLocations = (): TerminalLocation[] =>
  readIdentityCatalog().terminals.map((terminal) =>
    toTerminalLocation(terminal)
  );

/**
 * Convert one canonical terminal row into the legacy terminal-location shape.
 *
 * @param terminal - Canonical terminal identity row
 * @returns Terminal location compatibility object
 */
const toTerminalLocation = (terminal: {
  TerminalID: number;
  TerminalName: string;
  TerminalAbbrev: string;
  Latitude?: number;
  Longitude?: number;
}) => {
  const topology = getTerminalTopologyByTerminalAbbrev(
    readIdentityCatalog(),
    terminal.TerminalAbbrev
  );
  const routeAbbrevs = topology?.RouteAbbrevs ?? [];

  return {
    TerminalID: terminal.TerminalID,
    TerminalName: terminal.TerminalName,
    TerminalAbbrev: terminal.TerminalAbbrev,
    Latitude: terminal.Latitude,
    Longitude: terminal.Longitude,
    routeAbbrevs,
    routeAbbrev: routeAbbrevs.length === 1 ? (routeAbbrevs[0] ?? null) : null,
    TerminalMates: topology?.TerminalMates ?? [],
  } satisfies TerminalLocation;
};

const getTerminalTopologyByTerminalAbbrev = (
  catalog: IdentityCatalogState,
  terminalAbbrev: string
) => catalog.terminalsTopologyByAbbrev[terminalAbbrev.toUpperCase()] ?? null;
