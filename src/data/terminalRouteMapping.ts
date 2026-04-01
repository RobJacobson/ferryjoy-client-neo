/**
 * Resolve schedule-query route abbreviations from the current terminal
 * selection.
 */

import {
  type TerminalsTopologyDataContextValue,
  useTerminalsTopologyData,
} from "@/data/contexts/identity";
import type { SelectedTerminalPair } from "@/data/contexts/SelectedTerminalPairContext";

const DEFAULT_ROUTE_ABBREVS = ["sea-bi"];

type TerminalsTopologyByAbbrev =
  TerminalsTopologyDataContextValue["terminalsTopologyByAbbrev"];

/**
 * Resolve the route abbreviations that the schedules screen should query for
 * the current terminal selection.
 *
 * - `null` falls back to the default home route.
 * - `{ kind: "all" }` returns every route that departs from that terminal.
 * - `{ kind: "pair" }` returns only the route(s) between the two terminals.
 */
export const selectRouteAbbrevsForSelection = (
  terminalsTopologyByAbbrev: TerminalsTopologyByAbbrev,
  selectedTerminalPair: SelectedTerminalPair
): string[] => {
  if (!selectedTerminalPair) {
    return DEFAULT_ROUTE_ABBREVS;
  }

  const departingTopology =
    terminalsTopologyByAbbrev[
      (
        selectedTerminalPair.kind === "pair"
          ? selectedTerminalPair.from
          : selectedTerminalPair.terminal
      ).toUpperCase()
    ];

  if (!departingTopology) {
    return [];
  }

  if (selectedTerminalPair.kind === "all") {
    return departingTopology.RouteAbbrevs;
  }

  return (
    departingTopology.RouteAbbrevsByArrivingTerminal[
      selectedTerminalPair.dest.toUpperCase()
    ] ?? []
  );
};

export const useRouteAbbrevsForSelection = (
  selectedTerminalPair: SelectedTerminalPair
): string[] => {
  const { terminalsTopologyByAbbrev } = useTerminalsTopologyData();

  return selectRouteAbbrevsForSelection(
    terminalsTopologyByAbbrev,
    selectedTerminalPair
  );
};
