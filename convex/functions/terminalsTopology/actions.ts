/**
 * Convex action entrypoints for derived terminals topology sync.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { action, internalAction } from "_generated/server";
import { v } from "convex/values";
import {
  fetchRoutesByTripDateAndTerminals,
  fetchTerminalsAndMates,
  type Route,
} from "ws-dottie/wsf-schedule/core";
import { getSailingDay } from "../../shared/time";
import {
  loadBackendTerminals,
  syncBackendTerminalTable,
} from "../terminals/actions";
import type { Terminal } from "../terminals/schemas";
import type { TerminalTopology } from "./schemas";

/**
 * Refresh the backend terminals topology snapshot from WSF schedule data.
 *
 * @param ctx - Convex internal action context
 * @returns `null`
 */
export const refreshBackendTerminalsTopology = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await refreshBackendTerminalsTopologyImpl(ctx);
    return null;
  },
});

/**
 * Public entry point for manual refreshes and local scripts.
 *
 * @param ctx - Convex public action context
 * @returns `null`
 */
export const runRefreshBackendTerminalsTopology = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await refreshBackendTerminalsTopologyImpl(ctx);
    return null;
  },
});

/**
 * Load the backend terminals topology snapshot for one action tick.
 *
 * @param ctx - Convex action context
 * @returns Snapshot for the current action
 */
export const loadBackendTerminalsTopologyOrThrow = async (
  ctx: ActionCtx
): Promise<Array<TerminalTopology>> => {
  let rows = await ctx.runQuery(
    internal.functions.terminalsTopology.queries
      .getBackendTerminalsTopologyInternal
  );

  if (rows.length > 0) {
    return rows;
  }

  await refreshBackendTerminalsTopologyImpl(ctx);

  rows = await ctx.runQuery(
    internal.functions.terminalsTopology.queries
      .getBackendTerminalsTopologyInternal
  );

  if (rows.length === 0) {
    throw new Error(
      "Backend terminals topology rows are still missing after refresh."
    );
  }

  return rows;
};

/**
 * Shared implementation for topology refresh.
 *
 * @param ctx - Convex action context
 * @returns When the snapshot is refreshed
 */
const refreshBackendTerminalsTopologyImpl = async (
  ctx: ActionCtx
): Promise<void> => {
  try {
    const terminals = await ensureBackendTerminals(ctx);
    const rows = await buildBackendTerminalsTopologyRows(terminals);

    await ctx.runMutation(
      internal.functions.terminalsTopology.mutations
        .replaceBackendTerminalsTopology,
      {
        rows,
      }
    );
  } catch (error) {
    const normalized = normalizeUnknownError(error);
    console.error("refreshBackendTerminalsTopology failed:", normalized);
    throw normalized;
  }
};

/**
 * Ensure backend terminals exist before topology derivation runs.
 *
 * @param ctx - Convex action context
 * @returns Canonical backend terminals
 */
const ensureBackendTerminals = async (
  ctx: ActionCtx
): Promise<Array<Terminal>> => {
  const terminals = await loadBackendTerminals(ctx);

  if (terminals.length > 0) {
    return terminals;
  }

  await syncBackendTerminalTable(ctx);
  return await loadBackendTerminals(ctx);
};

/**
 * Build the topology rows from WSF schedule data and canonical backend
 * terminals.
 *
 * @param terminals - Canonical backend terminals
 * @returns Derived topology rows
 */
export const buildBackendTerminalsTopologyRows = async (
  terminals: Array<Terminal>
): Promise<Array<TerminalTopology>> => {
  const passengerTerminals = terminals.filter(
    (terminal) => terminal.IsPassengerTerminal !== false
  );
  const tripDate = getSailingDay(new Date());
  const terminalCombos = await fetchTerminalsAndMates({
    params: { TripDate: tripDate },
  });
  const pairRouteAbbrevs = new Map<string, Array<string>>();

  for (const combo of terminalCombos as Array<{
    DepartingTerminalID: number;
    ArrivingTerminalID: number;
  }>) {
    pairRouteAbbrevs.set(
      toTerminalPairKey(combo.DepartingTerminalID, combo.ArrivingTerminalID),
      normalizeRouteAbbrevs(
        await fetchRoutesByTripDateAndTerminals({
          params: {
            TripDate: tripDate,
            DepartingTerminalID: combo.DepartingTerminalID,
            ArrivingTerminalID: combo.ArrivingTerminalID,
          },
        })
      )
    );
  }

  return buildTerminalTopologyRows(
    passengerTerminals,
    terminalCombos as Array<{
      DepartingTerminalID: number;
      ArrivingTerminalID: number;
    }>,
    pairRouteAbbrevs,
    Date.now()
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
  terminals: Array<Terminal>,
  terminalCombos: Array<{
    DepartingTerminalID: number;
    ArrivingTerminalID: number;
  }>,
  pairRouteAbbrevs: Map<string, Array<string>>,
  updatedAt: number
): Array<TerminalTopology> => {
  const terminalsById = new Map<number, Terminal>(
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

/**
 * Normalize unknown thrown values into an Error.
 *
 * @param error - Unknown thrown value
 * @returns Normalized error instance
 */
const normalizeUnknownError = (error: unknown) => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : String(error));
};
