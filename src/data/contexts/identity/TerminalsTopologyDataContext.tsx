import { api } from "convex/_generated/api";
import { useQuery } from "convex/react";
import type { PropsWithChildren } from "react";
import { createContext, useContext } from "react";
import {
  deriveTerminalsTopologyData,
  TERMINALS_TOPOLOGY_ASSET,
  TERMINALS_TOPOLOGY_STORAGE_KEY,
  type TerminalsTopologyDerivedData,
  type TerminalsTopologySnapshot,
} from "./datasets";
import {
  type LayeredDatasetSource,
  useLayeredDataset,
} from "./useLayeredDataset";

export type TerminalsTopologyDataContextValue = Readonly<
  {
    data: TerminalsTopologySnapshot;
    source: LayeredDatasetSource;
    isHydrated: boolean;
  } & TerminalsTopologyDerivedData
>;

const TerminalsTopologyDataContext = createContext<
  TerminalsTopologyDataContextValue | undefined
>(undefined);

export const TerminalsTopologyDataProvider = ({
  children,
}: PropsWithChildren) => {
  const convexData = useQuery(
    api.functions.terminalsTopology.queries.getFrontendTerminalsTopologySnapshot
  );
  const value = useLayeredDataset({
    assetData: TERMINALS_TOPOLOGY_ASSET,
    storageKey: TERMINALS_TOPOLOGY_STORAGE_KEY,
    convexData,
    derive: deriveTerminalsTopologyData,
  });

  return (
    <TerminalsTopologyDataContext value={value}>
      {children}
    </TerminalsTopologyDataContext>
  );
};

export const useTerminalsTopologyData =
  (): TerminalsTopologyDataContextValue => {
    const context = useContext(TerminalsTopologyDataContext);
    if (!context) {
      throw new Error(
        "useTerminalsTopologyData must be used within TerminalsTopologyDataProvider"
      );
    }
    return context;
  };
