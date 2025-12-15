import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { toDomainVesselTrip } from "convex/functions/vesselTrips/schemas";
import { useQuery } from "convex/react";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";

// Re-export VesselTrip type for convenience
export type { VesselTrip };

/**
 * Type definition for the Convex Vessel Trips context value
 *
 * Provides access to vessel trips data with loading and error states
 */
type ConvexVesselTripsContextType = {
  /** Array of current active vessel trips converted to domain values */
  activeVesselTrips: VesselTrip[];
  /** Loading state for vessel trips data */
  isLoading: boolean;
  /** Error state for vessel trips data */
  error: string | null;
};

/**
 * React context for sharing vessel trips data across the app.
 *
 * This context provides access to vessel trips data with loading and error states.
 * It fetches active and completed vessel trips from Convex and transforms them into domain values.
 * Components can consume this context using the useConvexVesselTrips hook.
 */
const ConvexVesselTripsContext = createContext<
  ConvexVesselTripsContextType | undefined
>(undefined);

/**
 * Provider component that manages vessel trips data from Convex.
 *
 * This component fetches active and completed vessel trips from Convex,
 * transforms them into domain values,
 * and provides this data to child components through the context.
 *
 * @example
 * ```tsx
 * <ConvexVesselTripsProvider>
 *   <App />
 * </ConvexVesselTripsProvider>
 * ```
 *
 * @param props - Component props
 * @param props.children - Child components that will have access to the vessel trips data
 * @returns A context provider component
 */
export const ConvexVesselTripsProvider = ({ children }: PropsWithChildren) => {
  // Fetch all active vessel trips from Convex
  const activeTrips =
    useQuery(api.functions.vesselTrips.queries.getActiveTrips)?.map(
      toDomainVesselTrip
    ) || [];

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle loading and error states
  useEffect(() => {
    if (activeTrips !== undefined) {
      setIsLoading(false);
      setError(null);
    }
  }, [activeTrips]);

  const contextValue: ConvexVesselTripsContextType = {
    activeVesselTrips: activeTrips,
    isLoading,
    error,
  };

  return (
    <ConvexVesselTripsContext value={contextValue}>
      {children}
    </ConvexVesselTripsContext>
  );
};

/**
 * Hook to access vessel trips data with loading and error states.
 *
 * Provides vessel trips data with consistent loading and error states.
 * Must be used within a ConvexVesselTripsProvider component.
 *
 * @example
 * ```tsx
 * const { activeVesselTrips, completedVesselTrips, isLoading, error } = useConvexVesselTrips();
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 * return <VesselTripsList activeTrips={activeVesselTrips} completedTrips={completedVesselTrips} />;
 * ```
 *
 * @returns Object with active vessel trips, completed vessel trips, loading state, and error state
 * @throws Error if used outside of ConvexVesselTripsProvider
 */
export const useConvexVesselTrips = () => {
  const context = useContext(ConvexVesselTripsContext);
  if (context === undefined) {
    throw new Error(
      "useConvexVesselTrips must be used within ConvexVesselTripsProvider"
    );
  }
  return context;
};
