import { api } from "convex/_generated/api";
import { useQuery } from "convex/react";
import type { PropsWithChildren } from "react";
import { createContext, useContext } from "react";
import {
  deriveTerminalsData,
  TERMINALS_ASSET,
  TERMINALS_STORAGE_KEY,
  TERMINALS_STORAGE_SCHEMA,
  type TerminalsDerivedData,
  type TerminalsSnapshot,
} from "./datasets";
import {
  type LayeredDatasetSource,
  useLayeredDataset,
} from "./useLayeredDataset";

type TerminalsDataContextDebugValue = Readonly<
  {
    data: TerminalsSnapshot;
    source: LayeredDatasetSource;
    isHydrated: boolean;
  } & TerminalsDerivedData
>;

export type TerminalsDataContextValue = Omit<
  TerminalsDataContextDebugValue,
  "source" | "isHydrated"
>;

const TerminalsDataContext = createContext<
  TerminalsDataContextDebugValue | undefined
>(undefined);

export const TerminalsDataProvider = ({ children }: PropsWithChildren) => {
  const convexData = useQuery(
    api.functions.terminals.queries.getFrontendTerminalsSnapshot
  );
  const value = useLayeredDataset({
    assetData: TERMINALS_ASSET,
    storageKey: TERMINALS_STORAGE_KEY,
    storageSchema: TERMINALS_STORAGE_SCHEMA,
    convexData,
    derive: deriveTerminalsData,
  });

  return <TerminalsDataContext value={value}>{children}</TerminalsDataContext>;
};

export const useTerminalsData = (): TerminalsDataContextValue => {
  const context = useContext(TerminalsDataContext);
  if (!context) {
    throw new Error(
      "useTerminalsData must be used within TerminalsDataProvider"
    );
  }
  return context;
};
