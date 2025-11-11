import { useQuery } from "convex/react";
import type { PropsWithChildren } from "react";
import { createContext, useContext } from "react";
import { api } from "../../../convex/_generated/api";
import type { ConvexVesselPingCollection } from "../../../convex/functions/vesselPings/schemas";
import {
  toDomainVesselPing,
  type VesselPing,
} from "../../domain/vessels/vesselPing";

export type VesselPings = Record<number, VesselPing[]>;

/**
 * Type definition for the Convex context value
 *
 * Provides access to vessel pings data organized by vessel ID
 * This context is used to share vessel position data across the application.
 */
type ConvexContextType = {
  /** Object mapping VesselID to an array of VesselPings sorted by timestamp (most recent first) */
  vesselPings: VesselPings;
};

/**
 * React context for sharing vessel pings data across the app.
 *
 * This context provides access to vessel position data organized by vessel ID.
 * It fetches the latest 20 VesselPingCollections from Convex and transforms
 * them into a mapping of VesselID to an array of VesselPings sorted by timestamp.
 * Components can consume this context using the useConvex hook.
 */
const ConvexContext = createContext<ConvexContextType | undefined>(undefined);

/**
 * Provider component that manages vessel pings data from Convex.
 *
 * This component fetches the latest vessel ping collections from Convex,
 * transforms them into a mapping of vessel ID to an array of vessel pings,
 * and provides this data to child components through the context.
 *
 * @example
 * ```tsx
 * <ConvexProvider>
 *   <App />
 * </ConvexProvider>
 * ```
 *
 * @param props - Component props
 * @param props.children - Child components that will have access to the vessel pings data
 * @returns A context provider component
 */
export const ConvexProvider = ({ children }: PropsWithChildren) => {
  // Fetch the latest 20 VesselPingCollections from Convex
  const latestPingsCollections = useQuery(
    api.functions.vesselPings.queries.getLatest,
    { limit: 20 }
  );

  const contextValue: ConvexContextType = {
    vesselPings: toSortedGroupedPings(latestPingsCollections),
  };

  console.log(contextValue.vesselPings);

  return <ConvexContext value={contextValue}>{children}</ConvexContext>;
};

const toSortedGroupedPings = (
  latestPingsCollections: ConvexVesselPingCollection[] | undefined
) => {
  if (!latestPingsCollections) return {};

  // Transform the data into a mapping of VesselID to an array of VesselPings
  const vesselPings = latestPingsCollections
    .flatMap((collection) => collection.pings.map(toDomainVesselPing))
    .toSorted((a, b) => b.TimeStamp.getTime() - a.TimeStamp.getTime());

  // Group pings by VesselID using Object.groupBy (ES2023)
  const groupedPings = Object.groupBy(
    vesselPings || [],
    (ping) => ping.VesselID
  ) as Record<number, VesselPing[]>;

  return groupedPings;
};

/**
 * Hook to access vessel pings data.
 *
 * Provides access to vessel position data organized by vessel ID.
 * Must be used within a ConvexProvider component.
 *
 * @example
 * ```tsx
 * const { vesselPings } = useConvex();
 * const vessel123Pings = vesselPings[123];
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
