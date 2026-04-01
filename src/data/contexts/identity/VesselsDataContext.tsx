import { api } from "convex/_generated/api";
import { useQuery } from "convex/react";
import type { PropsWithChildren } from "react";
import { createContext, useContext } from "react";
import {
  deriveVesselsData,
  VESSELS_ASSET,
  VESSELS_STORAGE_KEY,
  type VesselsDerivedData,
  type VesselsSnapshot,
} from "./datasets";
import {
  type LayeredDatasetSource,
  useLayeredDataset,
} from "./useLayeredDataset";

export type VesselsDataContextValue = Readonly<
  {
    data: VesselsSnapshot;
    source: LayeredDatasetSource;
    isHydrated: boolean;
  } & VesselsDerivedData
>;

const VesselsDataContext = createContext<VesselsDataContextValue | undefined>(
  undefined
);

export const VesselsDataProvider = ({ children }: PropsWithChildren) => {
  const convexData = useQuery(
    api.functions.vesselLocation.queries.getFrontendVesselsSnapshot
  );
  const value = useLayeredDataset({
    assetData: VESSELS_ASSET,
    storageKey: VESSELS_STORAGE_KEY,
    convexData,
    derive: deriveVesselsData,
  });

  return <VesselsDataContext value={value}>{children}</VesselsDataContext>;
};

export const useVesselsData = (): VesselsDataContextValue => {
  const context = useContext(VesselsDataContext);
  if (!context) {
    throw new Error("useVesselsData must be used within VesselsDataProvider");
  }
  return context;
};
