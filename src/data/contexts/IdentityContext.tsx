/**
 * Frontend identity provider backed by assets, local storage, and live Convex
 * snapshot queries.
 */

import { api } from "convex/_generated/api";
import { useQuery } from "convex/react";
import type { PropsWithChildren } from "react";
import { useEffect, useSyncExternalStore } from "react";
import {
  type FrontendTerminalSnapshot,
  type FrontendTerminalsTopologySnapshot,
  type FrontendVesselSnapshot,
  IDENTITY_TERMINALS_ASSET,
  IDENTITY_TERMINALS_STORAGE_KEY,
  IDENTITY_TERMINALS_TOPOLOGY_ASSET,
  IDENTITY_TERMINALS_TOPOLOGY_STORAGE_KEY,
  IDENTITY_VESSELS_ASSET,
  IDENTITY_VESSELS_STORAGE_KEY,
  type IdentityCatalogState,
  readIdentityCatalog,
  replaceIdentityCatalogSnapshots,
  subscribeIdentityCatalog,
} from "@/data/identity";
import { storageKv } from "@/shared/storage";

/**
 * Subscribe to global identity snapshots and persist the live Convex payloads
 * locally when they arrive.
 *
 * @param props - Component props
 * @param props.children - Descendant React tree
 * @returns Provider wrapper with side effects only
 */
export const IdentityProvider = ({ children }: PropsWithChildren) => {
  const rawVessels = useQuery(
    api.functions.vesselLocation.queries.getFrontendVesselsSnapshot
  );
  const rawTerminals = useQuery(
    api.functions.terminals.queries.getFrontendTerminalsSnapshot
  );
  const rawTerminalsTopology = useQuery(
    api.functions.terminalsTopology.queries.getFrontendTerminalsTopologySnapshot
  );

  useEffect(() => {
    void hydrateIdentitySnapshotFromStorage();
  }, []);

  useEffect(() => {
    if (!rawVessels) {
      return;
    }

    replaceIdentityCatalogSnapshots({ vessels: rawVessels });
    void storageKv.setJson(IDENTITY_VESSELS_STORAGE_KEY, rawVessels);
  }, [rawVessels]);

  useEffect(() => {
    if (!rawTerminals) {
      return;
    }

    replaceIdentityCatalogSnapshots({ terminals: rawTerminals });
    void storageKv.setJson(IDENTITY_TERMINALS_STORAGE_KEY, rawTerminals);
  }, [rawTerminals]);

  useEffect(() => {
    if (!rawTerminalsTopology) {
      return;
    }

    replaceIdentityCatalogSnapshots({
      terminalsTopology: rawTerminalsTopology,
    });
    void storageKv.setJson(
      IDENTITY_TERMINALS_TOPOLOGY_STORAGE_KEY,
      rawTerminalsTopology
    );
  }, [rawTerminalsTopology]);

  return children;
};

/**
 * Subscribe to the current in-memory identity catalog.
 *
 * @returns Current identity catalog state
 */
export const useIdentityCatalog = (): IdentityCatalogState =>
  useSyncExternalStore(
    subscribeIdentityCatalog,
    readIdentityCatalog,
    readIdentityCatalog
  );

/**
 * Hydrate the in-memory catalog from local storage, falling back to the
 * committed asset defaults for any missing blob.
 */
const hydrateIdentitySnapshotFromStorage = async () => {
  const [storedVessels, storedTerminals, storedTopology] = await Promise.all([
    storageKv.getJson<FrontendVesselSnapshot>(IDENTITY_VESSELS_STORAGE_KEY),
    storageKv.getJson<FrontendTerminalSnapshot>(IDENTITY_TERMINALS_STORAGE_KEY),
    storageKv.getJson<FrontendTerminalsTopologySnapshot>(
      IDENTITY_TERMINALS_TOPOLOGY_STORAGE_KEY
    ),
  ]);
  const storedTopologyValue =
    storedTopology.ok && Array.isArray(storedTopology.value)
      ? storedTopology.value
      : null;

  if (storedTopology.ok && storedTopology.value && !storedTopologyValue) {
    await storageKv.remove(IDENTITY_TERMINALS_TOPOLOGY_STORAGE_KEY);
  }

  replaceIdentityCatalogSnapshots({
    vessels: storedVessels.ok
      ? (storedVessels.value ?? IDENTITY_VESSELS_ASSET)
      : IDENTITY_VESSELS_ASSET,
    terminals: storedTerminals.ok
      ? (storedTerminals.value ?? IDENTITY_TERMINALS_ASSET)
      : IDENTITY_TERMINALS_ASSET,
    terminalsTopology: storedTopologyValue ?? IDENTITY_TERMINALS_TOPOLOGY_ASSET,
  });
};
