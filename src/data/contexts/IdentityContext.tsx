/**
 * Frontend identity provider backed by assets, local storage, and live Convex
 * snapshot queries.
 */

import { api } from "convex/_generated/api";
import type { PropsWithChildren } from "react";
import { useEffect, useSyncExternalStore } from "react";
import { useQuery } from "convex/react";
import {
  getIdentityCatalogSnapshot,
  getIdentityTerminalsAsset,
  getIdentityTerminalsStorageKey,
  getIdentityTerminalsTopologyAsset,
  getIdentityTerminalsTopologyStorageKey,
  getIdentityVesselsAsset,
  getIdentityVesselsStorageKey,
  replaceIdentityCatalogSnapshots,
  subscribeIdentityCatalog,
  type IdentityCatalogState,
  type FrontendTerminalSnapshot,
  type FrontendTerminalsTopologySnapshot,
  type FrontendVesselSnapshot,
} from "@/data/identity/catalog";
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
    void storageKv.setJson(getIdentityVesselsStorageKey(), rawVessels);
  }, [rawVessels]);

  useEffect(() => {
    if (!rawTerminals) {
      return;
    }

    replaceIdentityCatalogSnapshots({ terminals: rawTerminals });
    void storageKv.setJson(getIdentityTerminalsStorageKey(), rawTerminals);
  }, [rawTerminals]);

  useEffect(() => {
    if (!rawTerminalsTopology) {
      return;
    }

    replaceIdentityCatalogSnapshots({ terminalsTopology: rawTerminalsTopology });
    void storageKv.setJson(
      getIdentityTerminalsTopologyStorageKey(),
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
    getIdentityCatalogSnapshot,
    getIdentityCatalogSnapshot
  );

/**
 * Hydrate the in-memory catalog from local storage, falling back to the
 * committed asset defaults for any missing blob.
 */
const hydrateIdentitySnapshotFromStorage = async () => {
  const [storedVessels, storedTerminals, storedTopology] = await Promise.all([
    storageKv.getJson<FrontendVesselSnapshot>(getIdentityVesselsStorageKey()),
    storageKv.getJson<FrontendTerminalSnapshot>(getIdentityTerminalsStorageKey()),
    storageKv.getJson<FrontendTerminalsTopologySnapshot>(
      getIdentityTerminalsTopologyStorageKey()
    ),
  ]);
  const storedTopologyValue =
    storedTopology.ok && Array.isArray(storedTopology.value)
      ? storedTopology.value
      : null;

  if (storedTopology.ok && storedTopology.value && !storedTopologyValue) {
    await storageKv.remove(getIdentityTerminalsTopologyStorageKey());
  }

  replaceIdentityCatalogSnapshots({
    vessels: storedVessels.ok
      ? (storedVessels.value ?? getIdentityVesselsAsset())
      : getIdentityVesselsAsset(),
    terminals: storedTerminals.ok
      ? (storedTerminals.value ?? getIdentityTerminalsAsset())
      : getIdentityTerminalsAsset(),
    terminalsTopology: storedTopologyValue ?? getIdentityTerminalsTopologyAsset(),
  });
};
