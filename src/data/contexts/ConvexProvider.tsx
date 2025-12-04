import type { PropsWithChildren } from "react";
import { ConvexVesselLocationsProvider } from "./ConvexVesselLocationsContext";
import { ConvexVesselPingsProvider } from "./ConvexVesselPingsContext";

/**
 * Combined provider that includes both vessel locations and vessel pings contexts.
 *
 * This is a convenience provider that wraps both ConvexVesselLocationsProvider
 * and ConvexVesselPingsProvider so you don't need to nest them manually.
 *
 * @example
 * ```tsx
 * <ConvexCombinedProvider>
 *   <App />
 * </ConvexCombinedProvider>
 * ```
 *
 * @param props - Component props
 * @param props.children - Child components that will have access to both contexts
 * @returns A provider component that wraps both contexts
 */
export const ConvexProvider = ({ children }: PropsWithChildren) => {
  return (
    <ConvexVesselLocationsProvider>
      <ConvexVesselPingsProvider>{children}</ConvexVesselPingsProvider>
    </ConvexVesselLocationsProvider>
  );
};
