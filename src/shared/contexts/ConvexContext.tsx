import type { PropsWithChildren } from "react";
import { createContext, useContext } from "react";

import type { ActiveVesselTrip } from "@/domain/vessels/activeVesselTrip";
import type { CompletedVesselTrip } from "@/domain/vessels/completedVesselTrip";
import type { VesselPing } from "@/domain/vessels/vesselPing";

// Combined type for all vessel trips (active or completed)
export type VesselTrip = ActiveVesselTrip | CompletedVesselTrip;

/**
 * Maps vessel IDs to arrays of their historical pings
 */
type VesselPingsMap = Record<number, VesselPing[]>;

/**
 * Combined context value providing both VesselPing and VesselTrip data.
 * Contains pings from the past 20 minutes, grouped by vessel, and all trip data.
 */
type ConvexContextType = {
  // VesselPing data
  vesselPings: VesselPingsMap;
  latestTimeStampMs: number;
  refreshPings: () => Promise<void>;

  // VesselTrip data
  tripData: VesselTrip[] | undefined;
  isLoadingTrips: boolean;
  error?: Error;
};

/**
 * React context for sharing both VesselPing and VesselTrip data across the app.
 * Provides ping data for all vessels from the past 20 minutes with real-time updates,
 * and trip data combining both active and completed trips.
 */
const ConvexContext = createContext<ConvexContextType | undefined>(undefined);

/**
 * Provider component that fetches both VesselPing and VesselTrip data.
 * Combines the functionality of VesselPingProvider and VesselTripProvider.
 */
export const ConvexProvider = ({ children }: PropsWithChildren) => {
  // These would be replaced with actual hooks in the implementation
  // For now, we're creating the structure based on the existing contexts

  // Placeholder for vessel pings data - would use useConvexVesselPings() in actual implementation
  const vesselPings: VesselPingsMap = {};
  const latestTimeStampMs = Date.now();
  const refreshPings = async () => {
    // Implementation would refresh vessel pings
    console.log("Refreshing vessel pings");
  };

  // Placeholder for trip data - would use useQuery() in actual implementation
  const tripData: VesselTrip[] | undefined = undefined;
  const isLoadingTrips = true;

  const contextValue: ConvexContextType = {
    vesselPings,
    latestTimeStampMs,
    refreshPings,
    tripData,
    isLoadingTrips,
  };

  return <ConvexContext value={contextValue}>{children}</ConvexContext>;
};

/**
 * Hook to access both VesselPing and VesselTrip data.
 * Provides unified access to pings and trips data.
 * Must be used within ConvexProvider.
 */
export const useConvexData = (): ConvexContextType => {
  const context = useContext(ConvexContext);
  if (context === undefined) {
    throw new Error("useConvexData must be used within a ConvexProvider");
  }
  return context;
};
