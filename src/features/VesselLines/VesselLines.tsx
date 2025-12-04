/**
 * VesselLines component
 *
 * Container component that manages and renders vessel track lines for all vessels.
 * Fetches vessel ping data from ConvexVesselPingsContext and renders VesselLineWrapper components.
 */

import type React from "react";
import { useConvexVesselPings } from "@/data/contexts/ConvexVesselPingsContext";
import { useSmoothedVesselPositions } from "@/data/contexts/SmoothedVesselPositionsContext";
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
  const { vesselPingsByVesselId: vesselPings } = useConvexVesselPings();
  const { smoothedVessels } = useSmoothedVesselPositions();

  // Create VesselLineWrapper components
  const vesselLineComponents = Object.entries(vesselPings)
    .map(([vesselId, pings]) => {
      const id = parseInt(vesselId, 10);
      const smoothedVessel = smoothedVessels.find((v) => v.VesselID === id);
      // Create and return VesselLine component
      return (
        <VesselLine
          key={`vessel-line-${vesselId}`}
          vesselId={vesselId}
          pings={pings}
          currentPosition={smoothedVessel}
        />
      );
    })
    .filter((component): component is React.ReactElement => component !== null);

  return <>{vesselLineComponents}</>;
};
