/**
 * Shared frontend identity catalog state, fallback assets, and lookup helpers.
 */

import type { Vessel } from "functions/vessels/schemas";
import type { Terminal } from "functions/terminals/schemas";
import type { TerminalTopology } from "functions/terminalsTopology/schemas";
import { storageKv } from "@/shared/storage";

export type FrontendVesselSnapshot = Array<Vessel>;
export type FrontendTerminalSnapshot = Array<Terminal>;
export type FrontendTerminalsTopologySnapshot = Array<TerminalTopology>;

export type IdentityCatalogState = Readonly<{
  vessels: FrontendVesselSnapshot;
  terminals: FrontendTerminalSnapshot;
  terminalsTopology: FrontendTerminalsTopologySnapshot;
  vesselByAbbrev: Record<string, Vessel>;
  vesselByName: Record<string, Vessel>;
  vesselById: Record<string, Vessel>;
  terminalByAbbrev: Record<string, Terminal>;
  terminalByName: Record<string, Terminal>;
  terminalById: Record<string, Terminal>;
  terminalTopologyByAbbrev: Record<string, TerminalTopology>;
}>;

const vesselsAsset = require("../../../assets/data/vessels.json") as FrontendVesselSnapshot;
const terminalsAsset = require("../../../assets/data/terminals.json") as FrontendTerminalSnapshot;
const terminalsTopologyAsset = require("../../../assets/data/terminalsTopology.json") as FrontendTerminalsTopologySnapshot;

const identityVesselsStorageKey = storageKv.makeKey({
  scope: "identity",
  version: "v1",
  key: "vessels",
});

const identityTerminalsStorageKey = storageKv.makeKey({
  scope: "identity",
  version: "v1",
  key: "terminals",
});

const identityTerminalsTopologyStorageKey = storageKv.makeKey({
  scope: "identity",
  version: "v1",
  key: "terminalsTopology",
});

let identityCatalogState: IdentityCatalogState = buildIdentityCatalogState({
  vessels: vesselsAsset,
  terminals: terminalsAsset,
  terminalsTopology: terminalsTopologyAsset,
});

const listeners = new Set<() => void>();

/**
 * Subscribe to synchronous identity catalog updates.
 *
 * @param listener - Listener invoked whenever the in-memory catalog changes
 * @returns Unsubscribe function
 */
export const subscribeIdentityCatalog = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Get the current identity catalog snapshot.
 *
 * @returns Current in-memory identity catalog
 */
export const getIdentityCatalogSnapshot = (): IdentityCatalogState =>
  identityCatalogState;

/**
 * Replace any combination of snapshot blobs and rebuild the derived indexes.
 *
 * @param next - Partial snapshot payloads to replace
 * @returns Updated identity catalog state
 */
export const replaceIdentityCatalogSnapshots = (next: {
  vessels?: FrontendVesselSnapshot;
  terminals?: FrontendTerminalSnapshot;
  terminalsTopology?: FrontendTerminalsTopologySnapshot;
}) => {
  identityCatalogState = buildIdentityCatalogState({
    vessels: next.vessels ?? identityCatalogState.vessels,
    terminals: next.terminals ?? identityCatalogState.terminals,
    terminalsTopology: next.terminalsTopology ?? identityCatalogState.terminalsTopology,
  });
  notifyIdentityCatalogListeners();
  return identityCatalogState;
};

/**
 * Get the versioned storage key for the vessels snapshot.
 *
 * @returns Storage key string
 */
export const getIdentityVesselsStorageKey = () => identityVesselsStorageKey;

/**
 * Get the versioned storage key for the terminals snapshot.
 *
 * @returns Storage key string
 */
export const getIdentityTerminalsStorageKey = () => identityTerminalsStorageKey;

/**
 * Get the versioned storage key for the terminals topology snapshot.
 *
 * @returns Storage key string
 */
export const getIdentityTerminalsTopologyStorageKey = () =>
  identityTerminalsTopologyStorageKey;

/**
 * Resolve a vessel from the current catalog by abbreviation.
 *
 * @param vesselAbbrev - Vessel abbreviation
 * @returns Matching vessel row or `null`
 */
export const getVesselByAbbrev = (vesselAbbrev: string): Vessel | null =>
  identityCatalogState.vesselByAbbrev[vesselAbbrev.toUpperCase()] ?? null;

/**
 * Resolve a vessel from the current catalog by name.
 *
 * @param vesselName - Vessel name
 * @returns Matching vessel row or `null`
 */
export const getVesselByName = (vesselName: string): Vessel | null =>
  identityCatalogState.vesselByName[vesselName.trim()] ?? null;

/**
 * Resolve a terminal from the current catalog by abbreviation.
 *
 * @param terminalAbbrev - Terminal abbreviation
 * @returns Matching terminal row or `null`
 */
export const getTerminalByAbbrev = (
  terminalAbbrev: string
): Terminal | null =>
  identityCatalogState.terminalByAbbrev[terminalAbbrev.toUpperCase()] ?? null;

/**
 * Resolve a terminal from the current catalog by numeric ID.
 *
 * @param terminalId - Terminal ID
 * @returns Matching terminal row or `null`
 */
export const getTerminalById = (terminalId: number): Terminal | null =>
  identityCatalogState.terminalById[String(terminalId)] ?? null;

/**
 * Resolve a terminal from the current catalog by name.
 *
 * @param terminalName - Terminal name
 * @returns Matching terminal row or `null`
 */
export const getTerminalByName = (terminalName: string): Terminal | null =>
  identityCatalogState.terminalByName[terminalName.trim()] ?? null;

/**
 * Resolve one topology entry from the current catalog by terminal abbreviation.
 *
 * @param terminalAbbrev - Departing terminal abbreviation
 * @returns Matching topology entry or `null`
 */
export const getTerminalTopologyByAbbrev = (
  terminalAbbrev: string
): TerminalTopology | null =>
  identityCatalogState.terminalTopologyByAbbrev[terminalAbbrev.toUpperCase()] ??
  null;

/**
 * Return the committed asset fallback vessels snapshot.
 *
 * @returns Asset-backed vessels snapshot
 */
export const getIdentityVesselsAsset = () => vesselsAsset;

/**
 * Return the committed asset fallback terminals snapshot.
 *
 * @returns Asset-backed terminals snapshot
 */
export const getIdentityTerminalsAsset = () => terminalsAsset;

/**
 * Return the committed asset fallback topology snapshot.
 *
 * @returns Asset-backed terminals topology snapshot
 */
export const getIdentityTerminalsTopologyAsset = () => terminalsTopologyAsset;

/**
 * Build the full identity catalog with lookup indexes from the raw snapshots.
 *
 * @param snapshots - Raw snapshot payloads
 * @returns In-memory identity catalog state
 */
function buildIdentityCatalogState({
  vessels,
  terminals,
  terminalsTopology,
}: {
  vessels: FrontendVesselSnapshot;
  terminals: FrontendTerminalSnapshot;
  terminalsTopology: FrontendTerminalsTopologySnapshot;
}): IdentityCatalogState {
  return {
  vessels,
  terminals,
  terminalsTopology,
  vesselByAbbrev: indexByUppercase(vessels, (vessel) => vessel.VesselAbbrev),
  vesselByName: indexByTrimmed(vessels, (vessel) => vessel.VesselName),
  vesselById: indexByString(vessels, (vessel) => vessel.VesselID),
  terminalByAbbrev: indexByUppercase(
    terminals,
    (terminal) => terminal.TerminalAbbrev
  ),
  terminalByName: indexByTrimmed(terminals, (terminal) => terminal.TerminalName),
  terminalById: indexByString(terminals, (terminal) => terminal.TerminalID),
  terminalTopologyByAbbrev: indexByUppercase(
    terminalsTopology,
    (terminalTopology) => terminalTopology.TerminalAbbrev
  ),
  };
}

/**
 * Build an uppercase-keyed record index.
 *
 * @param rows - Rows to index
 * @param getKey - Key selector
 * @returns Uppercase-keyed record
 */
function indexByUppercase<TRow>(
  rows: Array<TRow>,
  getKey: (row: TRow) => string
): Record<string, TRow> {
  return rows.reduce<Record<string, TRow>>((acc, row) => {
    acc[getKey(row).toUpperCase()] = row;
    return acc;
  }, {});
}

/**
 * Build a trimmed string-keyed record index.
 *
 * @param rows - Rows to index
 * @param getKey - Key selector
 * @returns Trimmed-keyed record
 */
function indexByTrimmed<TRow>(
  rows: Array<TRow>,
  getKey: (row: TRow) => string
): Record<string, TRow> {
  return rows.reduce<Record<string, TRow>>((acc, row) => {
    acc[getKey(row).trim()] = row;
    return acc;
  }, {});
}

/**
 * Build a stringified-key record index.
 *
 * @param rows - Rows to index
 * @param getKey - Key selector
 * @returns String-keyed record
 */
function indexByString<TRow>(
  rows: Array<TRow>,
  getKey: (row: TRow) => number
): Record<string, TRow> {
  return rows.reduce<Record<string, TRow>>((acc, row) => {
    acc[String(getKey(row))] = row;
    return acc;
  }, {});
}

/**
 * Notify all subscribers that the in-memory identity catalog changed.
 */
const notifyIdentityCatalogListeners = () => {
  for (const listener of listeners) {
    listener();
  }
};
