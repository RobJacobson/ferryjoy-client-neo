/**
 * VesselLines component
 *
 * Container component that manages and renders vessel track lines for all vessels.
 * Fetches vessel ping data from ConvexVesselPingsContext and renders VesselLineWrapper components.
 */

import type React from "react";
import { useConvexVesselPings } from "@/data/contexts/convex/ConvexVesselPingsContext";
import { useSmoothedVesselLocations } from "@/data/contexts/SmoothedVesselLocationsContext";
import { VesselLine } from "./VesselLine";

/**
 * VesselLines component
 *
 * Container component that fetches vessel ping data from ConvexContext
 * and renders VesselLineWrapper components for each vessel.
 *
 * @returns Array of VesselLineWrapper components
 *
 * @example
 * ```tsx
 * <VesselLines />
 * ```
 */
export const VesselLines = () => {
  const { vesselPingsByVesselAbbrev: vesselPings } = useConvexVesselPings();
  const { smoothedVessels } = useSmoothedVesselLocations();

  // Create VesselLineWrapper components
  const vesselLineComponents = Object.entries(vesselPings)
    .map(([vesselAbbrev, pings]) => {
      const smoothedVessel = smoothedVessels.find(
        (v) => v.VesselAbbrev === vesselAbbrev
      );
      // Create and return VesselLine component
      return (
        <VesselLine
          key={`vessel-line-${vesselAbbrev}`}
          vesselAbbrev={vesselAbbrev}
          pings={pings}
          currentPosition={smoothedVessel}
        />
      );
    })
    .filter((component): component is React.ReactElement => component !== null);

  return <>{vesselLineComponents}</>;
};
