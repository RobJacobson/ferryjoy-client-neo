import { api } from "convex/_generated/api";
import {
  toDomainVesselPing,
  type VesselPing,
} from "convex/functions/vesselPings/schemas";
import { useQuery } from "convex/react";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";

export type VesselPingsByVesselId = Record<number, VesselPing[]>;

/**
 * Type definition for the Convex Vessel Pings context value
 *
 * Provides access to vessel pings data with loading and error states
 */
type ConvexVesselPingsContextType = {
  /** Object mapping VesselID to an array of VesselPings sorted by timestamp (most recent first) */
  vesselPingsByVesselId: VesselPingsByVesselId;
  /** Loading state for vessel pings data */
  isLoading: boolean;
  /** Error state for vessel pings data */
  error: string | null;
};

/**
 * React context for sharing vessel pings data across the app.
 *
 * This context provides access to vessel pings data with loading and error states.
 * It fetches the latest 20 VesselPingCollections from Convex and transforms them into domain values.
 * Components can consume this context using the useConvexVesselPings hook.
 */
const ConvexVesselPingsContext = createContext<
  ConvexVesselPingsContextType | undefined
>(undefined);

/**
 * Provider component that manages vessel pings data from Convex.
 *
 * This component fetches the latest vessel ping collections from Convex,
 * transforms them into domain values,
 * and provides this data to child components through the context.
 *
 * @example
 * ```tsx
 * <ConvexVesselPingsProvider>
 *   <App />
 * </ConvexVesselPingsProvider>
 * ```
 *
 * @param props - Component props
 * @param props.children - Child components that will have access to the vessel pings data
 * @returns A context provider component
 */
export const ConvexVesselPingsProvider = ({ children }: PropsWithChildren) => {
  // Fetch the latest 20 VesselPingCollections from Convex
  const rawPings = useQuery(api.functions.vesselPings.queries.getLatest);

  // Memoize the transformation of raw pings to vesselPingsByVesselId
  const vesselPingsByVesselId =
    rawPings
      ?.flatMap((pingGroup) => pingGroup.pings)
      .map(toDomainVesselPing)
      .reduce(toVesselPingsByVesselId, {} as VesselPingsByVesselId) ??
    ({} as VesselPingsByVesselId);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle loading and error states
  useEffect(() => {
    if (rawPings !== undefined) {
      setIsLoading(false);
      setError(null);
    }
  }, [rawPings]);

  const contextValue: ConvexVesselPingsContextType = {
    vesselPingsByVesselId,
    isLoading,
    error,
  };

  return (
    <ConvexVesselPingsContext value={contextValue}>
      {children}
    </ConvexVesselPingsContext>
  );
};

const toVesselPingsByVesselId = (
  acc: VesselPingsByVesselId,
  ping: VesselPing
) => {
  const vesselId = ping.VesselID;
  if (!acc[vesselId]) {
    acc[vesselId] = [];
  }
  acc[vesselId].push(ping);
  return acc;
};

/**
 * Hook to access vessel pings data with loading and error states.
 *
 * Provides vessel pings data with consistent loading and error states.
 * Must be used within a ConvexVesselPingsProvider component.
 *
 * @example
 * ```tsx
 * const { vesselPings, isLoading, error } = useConvexVesselPings();
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 * const vessel123Pings = vesselPings[123];
 * return <VesselPingsList pings={vessel123Pings} />;
 * ```
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
