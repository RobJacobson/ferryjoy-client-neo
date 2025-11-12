/**
 * VesselLines component
 *
 * Container component that manages and renders vessel track lines for all vessels.
 * Fetches vessel ping data from ConvexVesselPingsContext, processes data for each vessel,
 * and renders VesselLine components with appropriate styling.
 */

import type React from "react";
import { smoothingConfig } from "@/config/smoothingConfig";
import type { VesselPing } from "@/domain/vessels/vesselPing";
import { useConvexVesselPings } from "@/shared/contexts/ConvexVesselPingsContext";
import { useSmoothedVesselPositions } from "@/shared/contexts/SmoothedVesselPositionsContext";
import { createSmoothedLine } from "./smoothing";
import { VesselLine } from "./VesselLine";

/**
 * VesselLines component
 *
 * Container component that fetches vessel ping data from ConvexContext,
 * processes data for each vessel, and renders VesselLine components.
 * Handles visibility based on zoom level to avoid clutter at low zoom.
 *
 * @returns Array of VesselLine components or null if below zoom threshold
 *
 * @example
 * ```tsx
 * <VesselLines />
 * ```
 */
export const VesselLines = () => {
  const { vesselPings } = useConvexVesselPings();
  const { smoothedVessels } = useSmoothedVesselPositions();

  // Process vessel data and create VesselLine components using reduce
  const vesselLineComponents = Object.entries(vesselPings).reduce(
    (acc, [vesselId, pings]) => {
      const id = parseInt(vesselId, 10);
      const smoothedVessel = smoothedVessels.find((v) => v.VesselID === id);

      const currentPosition = smoothedVessel
        ? ([smoothedVessel.Longitude, smoothedVessel.Latitude] as [
            number,
            number,
          ])
        : undefined;

      const line = smoothedLine(pings, currentPosition);

      if (!line) return acc;

      const inService = pings[0]?.AtDock === false;

      acc.push(
        <VesselLine
          key={`vessel-line-${vesselId}`}
          id={`vessel-${vesselId}`}
          line={line}
          inService={inService}
        />
      );

      return acc;
    },
    [] as React.ReactElement[]
  );

  return <>{vesselLineComponents}</>;
};

/**
 * Converts vessel pings to a GeoJSON LineString using configured smoothing method
 *
 * @param pings - Array of vessel pings
 * @param currentPosition - Optional current smoothed position [longitude, latitude] to prepend to the line
 * @returns GeoJSON LineString feature or null if not enough points
 */
export const smoothedLine = (
  pings: VesselPing[],
  currentPosition?: [number, number]
) => {
  return createSmoothedLine(pings, currentPosition, smoothingConfig.method, {
    tension: smoothingConfig.tension,
    resolution: smoothingConfig.resolution,
    sharpness: smoothingConfig.sharpness,
    maxPoints: smoothingConfig.maxPoints,
    minAgeSeconds: smoothingConfig.minAgeSeconds,
  });
};
