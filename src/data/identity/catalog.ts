/**
 * Shared frontend identity catalog state, subscription, and lookup helpers.
 * Snapshot assets, storage keys, and per-dataset index builders live in
 * `vessels.ts`, `terminals.ts`, `terminalsTopology.ts`, and `utils.ts`.
 */

import type { Terminal } from "functions/terminals/schemas";
import type { TerminalTopology } from "functions/terminalsTopology/schemas";
import type { Vessel } from "functions/vessels/schemas";
import {
  buildTerminalIndexes,
  type FrontendTerminalSnapshot,
  IDENTITY_TERMINALS_ASSET,
} from "./terminals";
import {
  buildTerminalTopologyIndexes,
  type FrontendTerminalsTopologySnapshot,
  IDENTITY_TERMINALS_TOPOLOGY_ASSET,
} from "./terminalsTopology";
import {
  buildVesselIndexes,
  type FrontendVesselSnapshot,
  IDENTITY_VESSELS_ASSET,
} from "./vessels";

export {
  IDENTITY_TERMINALS_ASSET,
  IDENTITY_TERMINALS_STORAGE_KEY,
} from "./terminals";
export {
  IDENTITY_TERMINALS_TOPOLOGY_ASSET,
  IDENTITY_TERMINALS_TOPOLOGY_STORAGE_KEY,
} from "./terminalsTopology";
export {
  IDENTITY_VESSELS_ASSET,
  IDENTITY_VESSELS_STORAGE_KEY,
} from "./vessels";

export type {
  FrontendTerminalSnapshot,
  FrontendTerminalsTopologySnapshot,
  FrontendVesselSnapshot,
};

export type IdentityCatalogState = Readonly<{
  vessels: FrontendVesselSnapshot;
  terminals: FrontendTerminalSnapshot;
  terminalsTopology: FrontendTerminalsTopologySnapshot;
  vesselsByAbbrev: Record<string, Vessel>;
  vesselsByName: Record<string, Vessel>;
  vesselsById: Record<string, Vessel>;
  terminalsByAbbrev: Record<string, Terminal>;
  terminalsByName: Record<string, Terminal>;
  terminalsById: Record<string, Terminal>;
  terminalsTopologyByAbbrev: Record<string, TerminalTopology>;
}>;

let identityCatalogState: IdentityCatalogState = buildIdentityCatalogState({
  vessels: IDENTITY_VESSELS_ASSET,
  terminals: IDENTITY_TERMINALS_ASSET,
  terminalsTopology: IDENTITY_TERMINALS_TOPOLOGY_ASSET,
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
 * Read the current identity catalog snapshot.
 *
 * @returns Current in-memory identity catalog
 */
export const readIdentityCatalog = (): IdentityCatalogState =>
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
    terminalsTopology:
      next.terminalsTopology ?? identityCatalogState.terminalsTopology,
  });
  notifyIdentityCatalogListeners();
  return identityCatalogState;
};

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
    ...buildVesselIndexes(vessels),
    ...buildTerminalIndexes(terminals),
    ...buildTerminalTopologyIndexes(terminalsTopology),
  };
}

/**
 * Notify all subscribers that the in-memory identity catalog changed.
 */
const notifyIdentityCatalogListeners = () => {
  for (const listener of listeners) {
    listener();
  }
};
