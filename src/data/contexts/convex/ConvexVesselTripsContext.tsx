/**
 * Convex-backed vessel trips context.
 *
 * Provides active vessel trips data from Convex. Historical (completed) trip
 * data is loaded via focused useQuery calls where needed (e.g. ScheduledTripTimeline).
 * Contexts provide pure data sources; UI behavior like hold windows
 * should be implemented in hooks or components that consume this data.
 */

import { api } from "convex/_generated/api";
import type {
  VesselTrip,
  VesselTripWithScheduledTrip,
} from "convex/functions/vesselTrips/schemas";
import { toDomainVesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";
import { useQuery } from "convex/react";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useMemo } from "react";

export type { VesselTrip, VesselTripWithScheduledTrip };

/**
 * Type definition for Convex Vessel Trips context value
 *
 * Provides access to active vessel trips data with loading and error states.
 * Trips include joined ScheduledTrip when available for display.
 */
type ConvexVesselTripsContextType = {
  /** Array of current active vessel trips with optional ScheduledTrip */
  activeVesselTrips: VesselTripWithScheduledTrip[];
  /** Loading state for vessel trips data */
  isLoading: boolean;
  /** Error state for vessel trips data */
  error: string | null;
};

/**
 * React context for sharing active vessel trips data across the app.
 *
 * This context provides access to active vessel trips with loading and error states.
 * Components can consume this context using the useConvexVesselTrips hook.
 */
const ConvexVesselTripsContext = createContext<
  ConvexVesselTripsContextType | undefined
>(undefined);

/**
 * Provider component that manages active vessel trips data from Convex.
 *
 * Fetches active vessel trips and provides them to child components.
 * Historical completed trips are loaded by consumers via getCompletedTripsForSailingDayAndTerminals where needed.
 *
 * @param props - Component props
 * @param props.children - Child components that will have access to the vessel trips data
 * @returns A context provider component
 */
export const ConvexVesselTripsProvider = ({ children }: PropsWithChildren) => {
  // Fetch active vessel trips with joined ScheduledTrip for display.
  const rawActiveTrips = useQuery(
    api.functions.vesselTrips.queries.getActiveTripsWithScheduledTrip,
  );
  const activeTrips = useMemo(
    () => rawActiveTrips?.map(toDomainVesselTripWithScheduledTrip) ?? [],
    [rawActiveTrips],
  );

  const isLoading = rawActiveTrips === undefined;
  const error: string | null = null;

  const contextValue: ConvexVesselTripsContextType = {
    activeVesselTrips: activeTrips,
    isLoading,
    error,
  };
  return (
    <ConvexVesselTripsContext.Provider value={contextValue}>
      {children}
    </ConvexVesselTripsContext.Provider>
  );
};

/**
 * Hook to access active vessel trips data with loading and error states.
 *
 * Must be used within a ConvexVesselTripsProvider component.
 *
 * @returns Object with active vessel trips, loading state, and error state
 * @throws Error if used outside of ConvexVesselTripsProvider
 */
export const useConvexVesselTrips = () => {
  const context = useContext(ConvexVesselTripsContext);
  if (context === undefined) {
    throw new Error(
      "useConvexVesselTrips must be used within ConvexVesselTripsProvider",
    );
  }
  return context;
};
