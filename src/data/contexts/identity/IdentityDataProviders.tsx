import type { PropsWithChildren } from "react";
import { TerminalsDataProvider } from "./TerminalsDataContext";
import { TerminalsTopologyDataProvider } from "./TerminalsTopologyDataContext";
import { VesselsDataProvider } from "./VesselsDataContext";

export const IdentityDataProviders = ({ children }: PropsWithChildren) => {
  return (
    <VesselsDataProvider>
      <TerminalsDataProvider>
        <TerminalsTopologyDataProvider>
          {children}
        </TerminalsTopologyDataProvider>
      </TerminalsDataProvider>
    </VesselsDataProvider>
  );
};
