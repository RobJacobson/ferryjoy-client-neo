/**
 * Terminal-to-route mapping helpers backed by the derived topology snapshot.
 */

import type { SelectedTerminalPair } from "@/data/contexts/SelectedTerminalPairContext";
import { readIdentityCatalog } from "@/data/identity";

const DEFAULT_ROUTE_ABBREVS = ["sea-bi"];

/**
 * Returns route abbreviations for a departing terminal and optional arriving
 * terminal.
 *
 * @param departingTerminalAbbrev - Departure terminal abbreviation
 * @param arrivingTerminalAbbrev - Optional destination terminal abbreviation
 * @returns Array of route abbreviations
 */
export const getRouteAbbrevs = (
  departingTerminalAbbrev: string,
  arrivingTerminalAbbrev?: string
): string[] => {
  const topology =
    readIdentityCatalog().terminalsTopologyByAbbrev[
      departingTerminalAbbrev.toUpperCase()
    ];

  if (!topology) {
    return [];
  }

  if (!arrivingTerminalAbbrev) {
    return topology.RouteAbbrevs;
  }

  return (
    topology.RouteAbbrevsByArrivingTerminal[
      arrivingTerminalAbbrev.toUpperCase()
    ] ?? []
  );
};

/**
 * Derive route abbreviations from the selected terminal pair state.
 *
 * @param selectedTerminalPair - Current selection from navigation state
 * @returns Matching route abbreviations or the default route selection
 */
export const getRouteAbbrevsForSelection = (
  selectedTerminalPair: SelectedTerminalPair
): string[] => {
  if (!selectedTerminalPair) {
    return DEFAULT_ROUTE_ABBREVS;
  }

  if (selectedTerminalPair.kind === "pair") {
    return getRouteAbbrevs(
      selectedTerminalPair.from,
      selectedTerminalPair.dest
    );
  }

  return getRouteAbbrevs(selectedTerminalPair.terminal, undefined);
};
