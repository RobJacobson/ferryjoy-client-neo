/**
 * Terminal-to-route mapping helpers backed by the derived topology snapshot.
 */

import { useMemo } from "react";
import {
  type TerminalsTopologyDataContextValue,
  useTerminalsTopologyData,
} from "@/data/contexts/identity";
import type { SelectedTerminalPair } from "@/data/contexts/SelectedTerminalPairContext";

const DEFAULT_ROUTE_ABBREVS = ["sea-bi"];

type TerminalsTopologyLookupData = Pick<
  TerminalsTopologyDataContextValue,
  "terminalsTopologyByAbbrev"
>;

/**
 * Returns route abbreviations for a departing terminal and optional arriving
 * terminal.
 *
 * @param topologyData - Topology dataset lookup maps
 * @param departingTerminalAbbrev - Departure terminal abbreviation
 * @param arrivingTerminalAbbrev - Optional destination terminal abbreviation
 * @returns Array of route abbreviations
 */
export const selectRouteAbbrevs = (
  topologyData: TerminalsTopologyLookupData,
  departingTerminalAbbrev: string,
  arrivingTerminalAbbrev?: string
): string[] => {
  const topology =
    topologyData.terminalsTopologyByAbbrev[
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
 * @param topologyData - Topology dataset lookup maps
 * @param selectedTerminalPair - Current selection from navigation state
 * @returns Matching route abbreviations or the default route selection
 */
export const selectRouteAbbrevsForSelection = (
  topologyData: TerminalsTopologyLookupData,
  selectedTerminalPair: SelectedTerminalPair
): string[] => {
  if (!selectedTerminalPair) {
    return DEFAULT_ROUTE_ABBREVS;
  }

  if (selectedTerminalPair.kind === "pair") {
    return selectRouteAbbrevs(
      topologyData,
      selectedTerminalPair.from,
      selectedTerminalPair.dest
    );
  }

  return selectRouteAbbrevs(
    topologyData,
    selectedTerminalPair.terminal,
    undefined
  );
};

export const useRouteAbbrevsForSelection = (
  selectedTerminalPair: SelectedTerminalPair
): string[] => {
  const topologyData = useTerminalsTopologyData();

  return useMemo(
    () => selectRouteAbbrevsForSelection(topologyData, selectedTerminalPair),
    [selectedTerminalPair, topologyData]
  );
};
