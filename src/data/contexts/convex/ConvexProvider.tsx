import type { PropsWithChildren } from "react";
import { ConvexVesselLocationsProvider } from "./ConvexVesselLocationsContext";
import { ConvexVesselPingsProvider } from "./ConvexVesselPingsContext";
import { ConvexVesselTripsProvider } from "./ConvexVesselTripsContext";

/**
 * Combined provider that includes vessel locations, vessel pings, and vessel trips contexts.
 *
 * This is a convenience provider that wraps ConvexVesselLocationsProvider,
 * ConvexVesselPingsProvider, and ConvexVesselTripsProvider so you don't need to nest them manually.
 *
 * @example
 * ```tsx
 * <ConvexProvider>
 *   <App />
 * </ConvexProvider>
 * ```
 *
 * @param props - Component props
 * @param props.children - Child components that will have access to all contexts
 * @returns A provider component that wraps all contexts
 */
export const ConvexProvider = ({ children }: PropsWithChildren) => {
  return (
    <ConvexVesselLocationsProvider>
      <ConvexVesselPingsProvider>
        <ConvexVesselTripsProvider>{children}</ConvexVesselTripsProvider>
      </ConvexVesselPingsProvider>
    </ConvexVesselLocationsProvider>
  );
};
