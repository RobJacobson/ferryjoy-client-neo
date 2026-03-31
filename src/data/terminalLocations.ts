/**
 * Terminal identity and topology helpers backed by the shared frontend
 * identity catalog.
 */

import {
  getIdentityCatalogSnapshot,
  getTerminalByAbbrev,
  getTerminalById,
  getTerminalTopologyByAbbrev,
} from "@/data/identity/catalog";

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
  const terminal = getTerminalByAbbrev(terminalAbbrev);

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
): string | null => getTerminalByAbbrev(terminalAbbrev)?.TerminalName ?? null;

/**
 * Get terminal location data by numeric terminal ID.
 *
 * @param terminalId - Terminal ID
 * @returns Terminal location view model or `null`
 */
export const getTerminalLocationById = (
  terminalId: number
): TerminalLocation | null => {
  const terminal = getTerminalById(terminalId);

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
  getIdentityCatalogSnapshot().terminals
    .map((terminal) => toTerminalLocation(terminal))
    .filter((terminal) => terminal.routeAbbrevs.includes(routeAbbrev));

/**
 * Get all terminals in the current catalog.
 *
 * @returns All terminal location view models
 */
export const getAllTerminalLocations = (): TerminalLocation[] =>
  getIdentityCatalogSnapshot().terminals.map((terminal) =>
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
  const topology = getTerminalTopologyByAbbrev(terminal.TerminalAbbrev);
  const routeAbbrevs = topology?.RouteAbbrevs ?? [];

  return {
    TerminalID: terminal.TerminalID,
    TerminalName: terminal.TerminalName,
    TerminalAbbrev: terminal.TerminalAbbrev,
    Latitude: terminal.Latitude,
    Longitude: terminal.Longitude,
    routeAbbrevs,
    routeAbbrev: routeAbbrevs.length === 1 ? routeAbbrevs[0] ?? null : null,
    TerminalMates: topology?.TerminalMates ?? [],
  } satisfies TerminalLocation;
};
