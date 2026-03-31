/**
 * Convex action entrypoints for backend terminal sync.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { action, internalAction } from "_generated/server";
import {
  fetchTerminalLocations,
  type TerminalLocation,
} from "ws-dottie/wsf-terminals/core";
import type { Terminal } from "./schemas";

type TerminalLocationWithIdentity = TerminalLocation & {
  TerminalName: string;
  TerminalAbbrev: string;
};

type ManualMarineLocation = Pick<
  Terminal,
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
 * Refresh the backend terminal table from WSF basics and persist the snapshot.
 *
 * Failures are reported without mutating the existing table so prior data
 * remains available to the rest of the system.
 *
 * @param ctx - Convex internal action context
 */
export const refreshBackendTerminals = internalAction({
  args: {},
  handler: async (ctx) => refreshBackendTerminalsImpl(ctx),
});

/**
 * Public entry point for `bunx convex run`, `convex:repopulate-terminals`, and
 * optional dev bootstrap scripts.
 *
 * @param ctx - Convex public action context
 */
export const runRefreshBackendTerminals = action({
  args: {},
  handler: async (ctx) => refreshBackendTerminalsImpl(ctx),
});

/**
 * Shared handler for internal cron and public `convex run` bootstrap.
 *
 * @param ctx - Convex action context
 */
async function refreshBackendTerminalsImpl(ctx: ActionCtx): Promise<void> {
  try {
    await refreshBackendTerminalsOrThrow(ctx);
  } catch (error) {
    const normalized = normalizeUnknownError(error);
    console.error("refreshBackendTerminals failed:", normalized);
    throw normalized;
  }
}

/**
 * Refresh the backend terminal table and throw on failure.
 *
 * @param ctx - Convex action context
 */
export async function refreshBackendTerminalsOrThrow(
  ctx: ActionCtx
): Promise<void> {
  const fetchedTerminals = await fetchTerminalLocations();
  const updatedAt = Date.now();
  const terminals = mergeKnownMarineLocations(
    fetchedTerminals
      .filter(hasTerminalIdentity)
      .map((terminal) => ({
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

  await ctx.runMutation(
    internal.functions.terminals.mutations.replaceBackendTerminals,
    {
      terminals,
    }
  );
}

/**
 * Load the backend terminal snapshot for one action tick.
 *
 * If the table is empty, bootstrap it immediately from WSF basics so callers
 * do not need to wait for the hourly refresh cron.
 *
 * @param ctx - Convex action context for database operations
 * @returns Backend terminals for the current action
 */
export async function loadBackendTerminalsOrThrow(
  ctx: ActionCtx
): Promise<Array<Terminal>> {
  let terminals: Array<Terminal> = await ctx.runQuery(
    internal.functions.terminals.queries.getAllBackendTerminalsInternal
  );

  if (terminals.length > 0) {
    return terminals;
  }

  await refreshBackendTerminalsOrThrow(ctx);

  terminals = await ctx.runQuery(
    internal.functions.terminals.queries.getAllBackendTerminalsInternal
  );

  if (terminals.length === 0) {
    throw new Error(
      "Backend terminals table is still empty after bootstrap refresh."
    );
  }

  return terminals;
}

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
  fetchedTerminals: Array<Terminal>,
  updatedAt: number
): Array<Terminal> => {
  const terminalsByAbbrev = new Map<string, Terminal>(
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
 * Normalize unknown thrown values into an Error with useful detail.
 *
 * Convex can surface structured error payloads that stringify to
 * `[object Object]`, so prefer JSON serialization when possible.
 *
 * @param error - Unknown thrown value
 * @returns Normalized Error instance with a readable message
 */
const normalizeUnknownError = (error: unknown) => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(safeSerialize(error));
};

/**
 * Serialize unknown values for logging.
 *
 * @param value - Unknown value to stringify
 * @returns Readable string representation for logs
 */
const safeSerialize = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

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
