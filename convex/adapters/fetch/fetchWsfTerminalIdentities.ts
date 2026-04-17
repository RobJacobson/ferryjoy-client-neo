/**
 * WSF terminal-identity boundary adapter.
 *
 * Wraps {@link fetchTerminalLocations}, rounds coordinates, merges known marine
 * facilities missing from the upstream feed, and maps to {@link TerminalIdentity}.
 */

import type { TerminalIdentity } from "functions/terminalIdentities/schemas";
import {
  fetchTerminalLocations,
  type TerminalLocation,
} from "ws-dottie/wsf-terminals/core";

type TerminalLocationWithIdentity = TerminalLocation & {
  TerminalName: string;
  TerminalAbbrev: string;
};

type ManualMarineLocation = Pick<
  TerminalIdentity,
  | "TerminalID"
  | "TerminalName"
  | "TerminalAbbrev"
  | "Latitude"
  | "Longitude"
  | "IsPassengerTerminal"
>;

const KNOWN_MARINE_LOCATIONS: ReadonlyArray<ManualMarineLocation> = [
  {
    TerminalID: -1001,
    TerminalName: "Eagle Harbor Maintenance Facility",
    TerminalAbbrev: "EAH",
    IsPassengerTerminal: false,
    Latitude: 47.62,
    Longitude: -122.5153,
  },
  {
    TerminalID: -1002,
    TerminalName: "Vigor Shipyard",
    TerminalAbbrev: "VIG",
    IsPassengerTerminal: false,
    Latitude: 47.5845,
    Longitude: -122.3579,
  },
];

/**
 * Fetches WSF terminal locations and returns merged backend snapshot rows.
 *
 * @param updatedAt - Shared refresh timestamp for every row
 * @returns Terminal identities including manual marine locations when absent
 *   from the feed
 */
export const fetchWsfTerminalIdentities = async (
  updatedAt: number
): Promise<Array<TerminalIdentity>> => {
  const fetchedTerminals = await fetchTerminalLocations();
  return mergeKnownMarineLocations(
    fetchedTerminals.filter(hasTerminalIdentity).map((terminal) => ({
      TerminalID: terminal.TerminalID,
      TerminalName: terminal.TerminalName.trim(),
      TerminalAbbrev: terminal.TerminalAbbrev.trim(),
      IsPassengerTerminal: true,
      Latitude: roundCoordinate(terminal.Latitude),
      Longitude: roundCoordinate(terminal.Longitude),
      UpdatedAt: updatedAt,
    })),
    updatedAt
  );
};

/**
 * Append known WSF-referenced marine locations that are omitted from the
 * upstream terminals basics feed.
 *
 * Upstream terminal rows win if WSF ever starts publishing one of these
 * abbreviations directly.
 *
 * @param fetchedTerminals - Canonical terminal rows from WSF basics
 * @param updatedAt - Shared refresh timestamp
 * @returns Merged marine-location snapshot
 */
export const mergeKnownMarineLocations = (
  fetchedTerminals: Array<TerminalIdentity>,
  updatedAt: number
): Array<TerminalIdentity> => {
  const terminalsByAbbrev = new Map<string, TerminalIdentity>(
    fetchedTerminals.map((terminal) => [terminal.TerminalAbbrev, terminal])
  );

  for (const location of KNOWN_MARINE_LOCATIONS) {
    if (terminalsByAbbrev.has(location.TerminalAbbrev)) {
      continue;
    }

    terminalsByAbbrev.set(location.TerminalAbbrev, {
      ...location,
      UpdatedAt: updatedAt,
    });
  }

  return [...terminalsByAbbrev.values()];
};

/**
 * Narrow raw WSF terminal basics to rows that contain the identity fields
 * required by the backend terminal table.
 *
 * @param terminal - Raw WSF terminal basics row
 * @returns True when the row contains both terminal name and abbreviation
 */
const hasTerminalIdentity = (
  terminal: TerminalLocation
): terminal is TerminalLocationWithIdentity =>
  Boolean(terminal.TerminalName && terminal.TerminalAbbrev);

/**
 * Round terminal coordinates to the stored backend precision.
 *
 * @param value - Raw WSF coordinate
 * @returns Coordinate rounded to four decimals, or `undefined` when absent
 */
const roundCoordinate = (value: number | null | undefined) =>
  value === null || value === undefined
    ? undefined
    : Math.round(value * 10000) / 10000;
