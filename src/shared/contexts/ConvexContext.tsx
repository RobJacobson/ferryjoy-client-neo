import type { ConvexVesselLocation } from "convex/functions/vesselLocation/schemas";
import { useQuery } from "convex/react";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import {
  toDomainVesselLocation,
  toDomainVesselPing,
  type VesselLocation,
  type VesselPing,
} from "@/domain";
import { api } from "../../../convex/_generated/api";
import type { ConvexVesselPingCollection } from "../../../convex/functions/vesselPings/schemas";

export type VesselPings = Record<number, VesselPing[]>;
export type VesselLocations = VesselLocation[];

/**
 * Type definition for the Convex context value
 *
 * Provides access to vessel pings data organized by vessel ID
 * and current vessel locations data
 * This context is used to share vessel position data across the application.
 */
type ConvexContextType = {
  /** Object mapping VesselID to an array of VesselPings sorted by timestamp (most recent first) */
  vesselPings: VesselPings;
  /** Array of current vessel locations converted to domain values */
  vesselLocations: VesselLocations;
};

/**
 * React context for sharing vessel pings and locations data across the app.
 *
 * This context provides access to vessel position data organized by vessel ID
 * and current vessel locations data.
 * It fetches the latest 20 VesselPingCollections and all current vessel locations from Convex
 * and transforms them into domain values.
 * Components can consume this context using the useConvex hook.
 */
const ConvexContext = createContext<ConvexContextType | undefined>(undefined);

/**
 * Provider component that manages vessel pings and locations data from Convex.
 *
 * This component fetches the latest vessel ping collections and current vessel locations from Convex,
 * transforms them into domain values,
 * and provides this data to child components through the context.
 *
 * @example
 * ```tsx
 * <ConvexProvider>
 *   <App />
 * </ConvexProvider>
 * ```
 *
 * @param props - Comptonent props
 * @param props.children - Child components that will have access to the vessel data
 * @returns A context provider component
 */
export const ConvexProvider = ({ children }: PropsWithChildren) => {
  // Fetch the latest 20 VesselPingCollections from Convex
  const latestPingsCollections = useQuery(
    api.functions.vesselPings.queries.getLatest,
    { limit: 20 }
  );

  // Fetch all current vessel locations from Convex
  const currentVesselLocations = useQuery(
    api.functions.vesselLocation.queries.getAll
  ).map(toDomainVesselLocation);

  const contextValue: ConvexContextType = {
    // Type assertion needed because Convex query types may not match codec input types
    vesselPings: toSortedGroupedPings(
      latestPingsCollections as unknown as
        | ConvexVesselPingCollection[]
        | undefined
    ),
    vesselLocations: currentVesselLocations,
  };

  return <ConvexContext value={contextValue}>{children}</ConvexContext>;
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
 * Hook to access vessel pings and locations data.
 *
 * Provides access to vessel position data organized by vessel ID
 * and current vessel locations data.
 * Must be used within a ConvexProvider component.
 *
 * @example
 * ```tsx
 * const { vesselPings, vesselLocations } = useConvexData();
 * const vessel123Pings = vesselPings[123];
 * const allVesselLocations = vesselLocations;
 * ```
 *
 * @returns The current Convex context value
 * @throws Error if used outside of ConvexProvider
 */
export const useConvexData = () => {
  const context = useContext(ConvexContext);
  if (context === undefined) {
    throw new Error("useConvexData must be used within ConvexProvider");
  }
  return context;
};

/**
 * Hook to access vessel locations with loading and error states.
 *
 * Provides vessel locations data with consistent loading and error states
 * similar to React Query patterns used in WsDottieContext.
 * Must be used within a ConvexProvider component.
 *
 * @example
 * ```tsx
 * const { vesselLocations, isLoading, error } = useConvexVesselLocations();
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 * return <VesselList vessels={vesselLocations} />;
 * ```
 *
 * @returns Object with vessel locations, loading state, and error state
 * @throws Error if used outside of ConvexProvider
 */
export const useConvexVesselLocations = () => {
  const { vesselLocations } = useConvexData();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle loading states
  useEffect(() => {
    if (vesselLocations !== undefined) {
      setIsLoading(false);
      setError(null);
    }
  }, [vesselLocations]);

  return { vesselLocations: vesselLocations || [], isLoading, error };
};
