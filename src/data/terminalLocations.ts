/**
 * Terminal identity and topology selectors backed by the shared data contexts.
 */

import type {
  TerminalsDataContextValue,
  TerminalsTopologyDataContextValue,
} from "@/data/contexts/identity";

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

type TerminalsLookupData = Pick<
  TerminalsDataContextValue,
  "data" | "terminalsByAbbrev" | "terminalsById"
>;

type TerminalsTopologyLookupData = Pick<
  TerminalsTopologyDataContextValue,
  "terminalsTopologyByAbbrev"
>;

/**
 * Get terminal location data by abbreviation.
 *
 * @param terminalsData - Terminals dataset and lookup maps
 * @param topologyData - Topology dataset lookup maps
 * @param terminalAbbrev - Terminal abbreviation
 * @returns Terminal location view model or `null`
 */
export const selectTerminalLocationByAbbrev = (
  terminalsData: TerminalsLookupData,
  topologyData: TerminalsTopologyLookupData,
  terminalAbbrev: string
): TerminalLocation | null => {
  const terminal =
    terminalsData.terminalsByAbbrev[terminalAbbrev.toUpperCase()];

  if (!terminal) {
    return null;
  }

  return toTerminalLocation(terminalsData, topologyData, terminal);
};

/**
 * Get terminal display name by abbreviation.
 *
 * @param terminalsData - Terminals dataset and lookup maps
 * @param terminalAbbrev - Terminal abbreviation
 * @returns Terminal name or `null`
 */
export const selectTerminalNameByAbbrev = (
  terminalsData: Pick<TerminalsDataContextValue, "terminalsByAbbrev">,
  terminalAbbrev: string
): string | null =>
  terminalsData.terminalsByAbbrev[terminalAbbrev.toUpperCase()]?.TerminalName ??
  null;

/**
 * Get terminal location data by numeric terminal ID.
 *
 * @param terminalsData - Terminals dataset and lookup maps
 * @param topologyData - Topology dataset lookup maps
 * @param terminalId - Terminal ID
 * @returns Terminal location view model or `null`
 */
export const selectTerminalLocationById = (
  terminalsData: TerminalsLookupData,
  topologyData: TerminalsTopologyLookupData,
  terminalId: number
): TerminalLocation | null => {
  const terminal = terminalsData.terminalsById[String(terminalId)];

  if (!terminal) {
    return null;
  }

  return toTerminalLocation(terminalsData, topologyData, terminal);
};

/**
 * Get all terminals associated with one route abbreviation.
 *
 * @param terminalsData - Terminals dataset and lookup maps
 * @param topologyData - Topology dataset lookup maps
 * @param routeAbbrev - Route abbreviation
 * @returns Matching terminal locations
 */
export const selectTerminalsByRoute = (
  terminalsData: TerminalsLookupData,
  topologyData: TerminalsTopologyLookupData,
  routeAbbrev: string
): TerminalLocation[] =>
  terminalsData.data
    .map((terminal) =>
      toTerminalLocation(terminalsData, topologyData, terminal)
    )
    .filter((terminal) => terminal.routeAbbrevs.includes(routeAbbrev));

/**
 * Get all terminals in the current data stores.
 *
 * @param terminalsData - Terminals dataset and lookup maps
 * @param topologyData - Topology dataset lookup maps
 * @returns All terminal location view models
 */
export const selectAllTerminalLocations = (
  terminalsData: TerminalsLookupData,
  topologyData: TerminalsTopologyLookupData
): TerminalLocation[] =>
  terminalsData.data.map((terminal) =>
    toTerminalLocation(terminalsData, topologyData, terminal)
  );

/**
 * Convert one canonical terminal row into the legacy terminal-location shape.
 *
 * @param terminal - Canonical terminal identity row
 * @returns Terminal location compatibility object
 */
const toTerminalLocation = (
  _terminalsData: TerminalsLookupData,
  topologyData: TerminalsTopologyLookupData,
  terminal: {
    TerminalID: number;
    TerminalName: string;
    TerminalAbbrev: string;
    Latitude?: number;
    Longitude?: number;
  }
) => {
  const topology = getTerminalTopologyByTerminalAbbrev(
    topologyData,
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
  topologyData: TerminalsTopologyLookupData,
  terminalAbbrev: string
) =>
  topologyData.terminalsTopologyByAbbrev[terminalAbbrev.toUpperCase()] ?? null;
