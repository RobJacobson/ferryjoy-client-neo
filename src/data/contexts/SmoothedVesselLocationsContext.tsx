import { createContext, type PropsWithChildren, useContext } from "react";
import type { VesselLocation } from "@/domain";
import { useSmoothedVesselLocations as useSmoothedVesselLocationsHook } from "../../shared/hooks/useSmoothedVesselLocations";
import { useConvexVesselLocations } from "./convex/ConvexVesselLocationsContext";

/**
 * Context value for smoothed vessel locations.
 * Contains animated vessel location data derived from convex hull updates.
 */
type SmoothedVesselLocationsContextValue = {
  smoothedVessels: VesselLocation[];
};

/**
 * Provides a shared store for smoothed vessel location updates.
 */
const SmoothedVesselLocationsContext =
  createContext<SmoothedVesselLocationsContextValue | null>(null);

/**
 * Hook that exposes the smoothed vessel locations for rendering layers.
 */
export const useSmoothedVesselLocations = () => {
  const context = useContext(SmoothedVesselLocationsContext);
  if (!context) {
    throw new Error(
      "useSmoothedVesselLocations must be used within a SmoothedVesselLocationsProvider"
    );
  }
  return context;
};

/**
 * Provider that smooths the vessel locations emitted from the convex context.
 */
export const SmoothedVesselLocationsProvider = ({
  children,
}: PropsWithChildren) => {
  const { vesselLocations } = useConvexVesselLocations();
  const currentVessels = vesselLocations ?? [];
  const smoothedVessels = useSmoothedVesselLocationsHook(currentVessels);

  const value = {
    smoothedVessels,
  };

  return (
    <SmoothedVesselLocationsContext.Provider value={value}>
      {children}
    </SmoothedVesselLocationsContext.Provider>
  );
};
