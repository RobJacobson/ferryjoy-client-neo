import { api } from "convex/_generated/api";
import { useConvexConnectionState, useQuery } from "convex/react";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import {
  type ConvexVesselPing,
  toDomainVesselPing,
  type VesselPing,
} from "@/types";

type VesselPingsByVesselAbbrev = Record<string, VesselPing[]>;

/**
 * Type definition for the Convex Vessel Pings context value
 *
 * Provides access to vessel pings data with loading and error states
 */
type ConvexVesselPingsContextType = {
  /** Map of `VesselAbbrev` → pings sorted by time (most recent first) */
  vesselPingsByVesselAbbrev: VesselPingsByVesselAbbrev;
  /** Loading state for vessel pings data */
  isLoading: boolean;
  /** Error state for vessel pings data */
  error: string | null;
};

/**
 * React context for sharing vessel pings data across the app.
 *
 * This context provides access to vessel pings data with loading and error states.
 * It loads recent pings from Convex and groups them by `VesselAbbrev`.
 * Components can consume this context using the useConvexVesselPings hook.
 */
const ConvexVesselPingsContext = createContext<
  ConvexVesselPingsContextType | undefined
>(undefined);

/** Refreshes the time window used by the pings query (client clock; avoids `Date.now()` in queries). */
const QUERY_NOW_REFRESH_MS = 30_000;

/**
 * Provider component that manages vessel pings data from Convex.
 *
 * @param props - Component props
 * @param props.children - Child components that will have access to the vessel pings data
 * @returns A context provider component
 */
export const ConvexVesselPingsProvider = ({ children }: PropsWithChildren) => {
  const connectionState = useConvexConnectionState();
  const [queryNowMs, setQueryNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setQueryNowMs(Date.now());
    }, QUERY_NOW_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const rawPings = useQuery(api.functions.vesselPings.queries.getLatest, {
    nowMs: queryNowMs,
  });

  const vesselPingsByVesselAbbrev: VesselPingsByVesselAbbrev = (
    rawPings ?? []
  ).reduce((acc: VesselPingsByVesselAbbrev, ping: ConvexVesselPing) => {
    const domainPing = toDomainVesselPing(ping);
    const key = ping.VesselAbbrev;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(domainPing);
    return acc;
  }, {} as VesselPingsByVesselAbbrev);

  Object.values(vesselPingsByVesselAbbrev).forEach((pings) => {
    pings.sort((a, b) => b.TimeStamp.getTime() - a.TimeStamp.getTime());
  });

  const hasConnectionIssue =
    rawPings === undefined &&
    !connectionState.isWebSocketConnected &&
    connectionState.connectionRetries > 0;
  const isLoading = rawPings === undefined && !hasConnectionIssue;
  const error = hasConnectionIssue
    ? "Unable to connect to live vessel pings."
    : null;

  const contextValue: ConvexVesselPingsContextType = {
    vesselPingsByVesselAbbrev,
    isLoading,
    error,
  };

  return (
    <ConvexVesselPingsContext value={contextValue}>
      {children}
    </ConvexVesselPingsContext>
  );
};

/**
 * Hook to access vessel pings data with loading and error states.
 *
 * Provides vessel pings data with consistent loading and error states.
 * Must be used within a ConvexVesselPingsProvider component.
 *
 * @returns Object with vessel pings, loading state, and error state
 * @throws Error if used outside of ConvexVesselPingsProvider
 */
export const useConvexVesselPings = () => {
  const context = useContext(ConvexVesselPingsContext);
  if (context === undefined) {
    throw new Error(
      "useConvexVesselPings must be used within ConvexVesselPingsProvider"
    );
  }
  return context;
};
