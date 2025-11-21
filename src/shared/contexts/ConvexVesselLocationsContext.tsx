import { useQuery } from "convex/react";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import type { CurrentVesselLocation, VesselLocation } from "@/domain";
import { toDomainVesselLocation } from "@/domain";
import { api } from "../../../convex/_generated/api";

export type VesselLocations = VesselLocation[];

/**
 * Type definition for the Convex Vessel Locations context value
 *
 * Provides access to vessel locations data with loading and error states
 */
type ConvexVesselLocationsContextType = {
  /** Array of current vessel locations converted to domain values */
  vesselLocations: VesselLocations;
  /** Loading state for vessel locations data */
  isLoading: boolean;
  /** Error state for vessel locations data */
  error: string | null;
};

/**
 * React context for sharing vessel locations data across the app.
 *
 * This context provides access to vessel locations data with loading and error states.
 * It fetches all current vessel locations from Convex and transforms them into domain values.
 * Components can consume this context using the useConvexVesselLocations hook.
 */
const ConvexVesselLocationsContext = createContext<
  ConvexVesselLocationsContextType | undefined
>(undefined);

/**
 * Provider component that manages vessel locations data from Convex.
 *
 * This component fetches current vessel locations from Convex,
 * transforms them into domain values,
 * and provides this data to child components through the context.
 *
 * @example
 * ```tsx
 * <ConvexVesselLocationsProvider>
 *   <App />
 * </ConvexVesselLocationsProvider>
 * ```
 *
 * @param props - Component props
 * @param props.children - Child components that will have access to the vessel locations data
 * @returns A context provider component
 */
export const ConvexVesselLocationsProvider = ({
  children,
}: PropsWithChildren) => {
  // Fetch all current vessel locations from Convex
  const currentVesselLocations = useQuery(
    api.functions.currentVesselLocation.queries.getAll
  );

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle loading and error states
  useEffect(() => {
    if (currentVesselLocations !== undefined) {
      setIsLoading(false);
      setError(null);
    }
  }, [currentVesselLocations]);

  const contextValue: ConvexVesselLocationsContextType = {
    vesselLocations: toDomainVesselLocations(currentVesselLocations),
    isLoading,
    error,
  };

  return (
    <ConvexVesselLocationsContext value={contextValue}>
      {children}
    </ConvexVesselLocationsContext>
  );
};

const toDomainVesselLocations = (
  currentVesselLocations: CurrentVesselLocation[] | undefined
): VesselLocations => {
  if (!currentVesselLocations) return [];

  return currentVesselLocations.map(toDomainVesselLocation);
};

/**
 * Hook to access vessel locations data with loading and error states.
 *
 * Provides vessel locations data with consistent loading and error states.
 * Must be used within a ConvexVesselLocationsProvider component.
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
 * @throws Error if used outside of ConvexVesselLocationsProvider
 */
export const useConvexVesselLocations = () => {
  const context = useContext(ConvexVesselLocationsContext);
  if (context === undefined) {
    throw new Error(
      "useConvexVesselLocations must be used within ConvexVesselLocationsProvider"
    );
  }
  return context;
};
