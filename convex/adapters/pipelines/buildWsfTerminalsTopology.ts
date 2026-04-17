/**
 * Builds {@link TerminalTopology} rows from WSF schedule mates + routes feeds.
 *
 * Composes {@link fetchWsfTerminalsAndMates} with
 * {@link fetchRoutesByTripDateAndTerminals} from `ws-dottie`; pure graph
 * assembly is {@link buildTerminalTopologyRows}.
 */

import type { TerminalIdentity } from "functions/terminalIdentities/schemas";
import type { TerminalTopology } from "functions/terminalsTopology/schemas";
import {
  fetchRoutesByTripDateAndTerminals,
  type Route,
} from "ws-dottie/wsf-schedule/core";
import {
  fetchWsfTerminalsAndMates,
  type WsfTerminalMatePair,
} from "../fetch/fetchWsfTerminalsAndMates";

/**
 * Loads schedule data and derives per-departing-terminal topology rows.
 *
 * @param terminals - Canonical backend terminals (passenger subset used
 *   internally)
 * @param options.tripDate - Sailing day for schedule queries
 * @param options.updatedAt - Shared row timestamp
 * @returns Topology rows sorted by departing terminal abbreviation
 */
export const buildWsfTerminalsTopology = async (
  terminals: Array<TerminalIdentity>,
  options: { tripDate: string; updatedAt: number }
): Promise<Array<TerminalTopology>> => {
  const passengerTerminals = terminals.filter(
    (terminal) => terminal.IsPassengerTerminal !== false
  );
  const terminalCombos = await fetchWsfTerminalsAndMates(options.tripDate);
  const pairRouteAbbrevs = new Map<string, Array<string>>();

  for (const combo of terminalCombos) {
    const routes = await fetchRoutesByTripDateAndTerminals({
      params: {
        TripDate: options.tripDate,
        DepartingTerminalID: combo.DepartingTerminalID,
        ArrivingTerminalID: combo.ArrivingTerminalID,
      },
    });
    pairRouteAbbrevs.set(
      toTerminalPairKey(combo.DepartingTerminalID, combo.ArrivingTerminalID),
      normalizeRouteAbbrevs(routes)
    );
  }

  return buildTerminalTopologyRows(
    passengerTerminals,
    [...terminalCombos],
    pairRouteAbbrevs,
    options.updatedAt
  );
};

/**
 * Build the per-terminal topology rows from canonical terminals, reachable
 * pairs, and pair-level route abbreviations.
 *
 * @param terminals - Canonical backend terminals
 * @param terminalCombos - Reachable terminal pairs
 * @param pairRouteAbbrevs - Route abbreviations keyed by numeric terminal pair
 * @param updatedAt - Shared topology refresh timestamp
 * @returns Topology rows sorted by terminal abbreviation
 */
export const buildTerminalTopologyRows = (
  terminals: Array<TerminalIdentity>,
  terminalCombos: Array<WsfTerminalMatePair>,
  pairRouteAbbrevs: Map<string, Array<string>>,
  updatedAt: number
): Array<TerminalTopology> => {
  const terminalsById = new Map<number, TerminalIdentity>(
    terminals.map((terminal) => [terminal.TerminalID, terminal])
  );
  const topologyByTerminalAbbrev: Record<string, TerminalTopology> = {};

  for (const combo of terminalCombos) {
    const departingTerminal = terminalsById.get(combo.DepartingTerminalID);
    const arrivingTerminal = terminalsById.get(combo.ArrivingTerminalID);

    if (!departingTerminal || !arrivingTerminal) {
      continue;
    }

    const departingAbbrev = departingTerminal.TerminalAbbrev;
    const arrivingAbbrev = arrivingTerminal.TerminalAbbrev;
    const routeAbbrevs =
      pairRouteAbbrevs.get(
        toTerminalPairKey(combo.DepartingTerminalID, combo.ArrivingTerminalID)
      ) ?? [];
    const current =
      topologyByTerminalAbbrev[departingAbbrev] ??
      createEmptyTopologyEntry(departingAbbrev, updatedAt);

    current.TerminalMates = mergeSortedStrings(current.TerminalMates, [
      arrivingAbbrev,
    ]);
    current.RouteAbbrevs = mergeSortedStrings(
      current.RouteAbbrevs,
      routeAbbrevs
    );
    current.RouteAbbrevsByArrivingTerminal[arrivingAbbrev] = routeAbbrevs;

    topologyByTerminalAbbrev[departingAbbrev] = current;
  }

  return Object.values(topologyByTerminalAbbrev).sort((left, right) =>
    left.TerminalAbbrev.localeCompare(right.TerminalAbbrev)
  );
};

/**
 * Create the empty topology entry for one departing terminal.
 *
 * @param terminalAbbrev - Canonical departing terminal abbreviation
 * @param updatedAt - Shared topology refresh timestamp
 * @returns Empty topology entry
 */
const createEmptyTopologyEntry = (
  terminalAbbrev: string,
  updatedAt: number
): TerminalTopology => ({
  TerminalAbbrev: terminalAbbrev,
  TerminalMates: [],
  RouteAbbrevs: [],
  RouteAbbrevsByArrivingTerminal: {},
  UpdatedAt: updatedAt,
});

/**
 * Normalize WSF route abbreviations into the app's canonical route slug set.
 *
 * @param routes - WSF route list for one terminal pair
 * @returns Distinct normalized route abbreviations
 */
const normalizeRouteAbbrevs = (routes: Array<Route>): string[] =>
  mergeSortedStrings(
    [],
    routes
      .map((route) => route.RouteAbbrev?.trim() ?? "")
      .filter(Boolean)
      .map((routeAbbrev) => normalizeRouteAbbrev(routeAbbrev))
  );

/**
 * Normalize a single WSF route abbreviation to the app's canonical slug.
 *
 * @param routeAbbrev - Raw WSF route abbreviation
 * @returns Canonical app route abbreviation
 */
const normalizeRouteAbbrev = (routeAbbrev: string): string => {
  const normalized = routeAbbrev.toLowerCase();

  if (normalized === "f-s" || normalized === "f-v" || normalized === "s-v") {
    return "f-v-s";
  }

  return normalized;
};

/**
 * Build the stable numeric terminal pair key.
 *
 * @param departingTerminalId - Departing terminal ID
 * @param arrivingTerminalId - Arriving terminal ID
 * @returns Stable key string for pair-level maps
 */
const toTerminalPairKey = (
  departingTerminalId: number,
  arrivingTerminalId: number
) => `${departingTerminalId}:${arrivingTerminalId}`;

/**
 * Merge, dedupe, and sort arrays of strings.
 *
 * @param left - Existing values
 * @param right - Incoming values
 * @returns Sorted unique string array
 */
const mergeSortedStrings = (left: Array<string>, right: Array<string>) =>
  [...new Set([...left, ...right])].sort((a, b) => a.localeCompare(b));
