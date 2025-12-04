import type { UseQueryResult } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { createContext, useContext } from "react";
import { Platform } from "react-native";
import {
  type TerminalVerbose,
  useTerminalVerbose,
} from "ws-dottie/wsf-terminals";
import {
  useVesselLocations,
  useVesselsVerbose,
  type VesselLocation,
  type VesselVerbose,
} from "ws-dottie/wsf-vessels";

type WsDottieContextValue = {
  vesselLocations: UseQueryResult<VesselLocation[], Error>;
  vesselsVerbose: UseQueryResult<VesselVerbose[], Error>;
  terminalVerbose: UseQueryResult<TerminalVerbose[], Error>;
};

const WsDottieContext = createContext<WsDottieContextValue | null>(null);

export const useWsDottie = () => {
  const context = useContext(WsDottieContext);
  if (!context) {
    throw new Error("useWsDottie must be used within a WsDottieProvider");
  }
  return context;
};

export const WsDottieProvider = ({ children }: PropsWithChildren) => {
  // Use JSONP for web platform, native for all other platforms
  const fetchMode = Platform.OS === "web" ? "jsonp" : "native";

  const vesselLocations = useVesselLocations({
    fetchMode,
    validate: false,
  });
  const vesselsVerbose = useVesselsVerbose({
    fetchMode,
    validate: false,
  });
  const terminalVerbose = useTerminalVerbose({
    fetchMode,
    validate: false,
  });

  const value = {
    vesselLocations,
    vesselsVerbose,
    terminalVerbose,
  };

  return (
    <WsDottieContext.Provider value={value}>
      {children}
    </WsDottieContext.Provider>
  );
};
