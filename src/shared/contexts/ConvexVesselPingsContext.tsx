import { useQuery } from "convex/react";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { ConvexVesselPingCollection } from "../../../convex/functions/vesselPings/schemas";
import {
  toDomainVesselPing,
  type VesselPing,
} from "../../domain/vessels/vesselPing";

export type VesselPings = Record<number, VesselPing[]>;

/**
 * Type definition for the Convex Vessel Pings context value
 *
 * Provides access to vessel pings data with loading and error states
 */
type ConvexVesselPingsContextType = {
  /** Object mapping VesselID to an array of VesselPings sorted by timestamp (most recent first) */
  vesselPings: VesselPings;
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
  const latestPingsCollections = useQuery(
    api.functions.vesselPings.queries.getLatest,
    { limit: 20 }
  );

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle loading and error states
  useEffect(() => {
    if (latestPingsCollections !== undefined) {
      setIsLoading(false);
      setError(null);
    }
  }, [latestPingsCollections]);

  const contextValue: ConvexVesselPingsContextType = {
    vesselPings: toSortedGroupedPings(latestPingsCollections),
    isLoading,
    error,
  };

  return (
    <ConvexVesselPingsContext value={contextValue}>
      {children}
    </ConvexVesselPingsContext>
  );
};

const toSortedGroupedPings = (
  latestPingsCollections: ConvexVesselPingCollection[] | undefined
) => {
  if (!latestPingsCollections) return {};

  // Transform the data into a sorted array of VesselPings
  const vesselPings = [
    ...latestPingsCollections.flatMap((collection) =>
      collection.pings.map(toDomainVesselPing)
    ),
  ].sort((a, b) => b.TimeStamp.getTime() - a.TimeStamp.getTime());

  // Group pings by VesselID using reduce to preserve sort order
  const groupedPings = vesselPings.reduce(
    (acc, ping) => {
      const vesselId = ping.VesselID;
      if (!acc[vesselId]) {
        acc[vesselId] = [];
      }
      acc[vesselId].push(ping);
      return acc;
    },
    {} as Record<number, VesselPing[]>
  );

  return groupedPings;
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
