/**
 * VesselLines component
 *
 * Container component that manages and renders vessel track lines for all vessels.
 * Fetches vessel ping data from ConvexVesselPingsContext, processes data for each vessel,
 * and renders VesselLine components with appropriate styling.
 */

import type React from "react";
import type { VesselPing } from "@/domain/vessels/vesselPing";
import { useConvexVesselPings } from "@/shared/contexts/ConvexVesselPingsContext";
import { useSmoothedVesselPositions } from "@/shared/contexts/SmoothedVesselPositionsContext";
import { filterVesselPings } from "./pingFilter";
import { createSmoothedLine } from "./smoothing";
import { VesselLine } from "./VesselLine";

// Smoothing configuration
const smoothingConfig = {
  // Method to use: 'd3-basis' | 'd3-cardinal' | 'd3-catmullRom' | 'turf-bezier'
  method: "d3-basis",

  // D3-specific parameters
  tension: 0.55, // Controls tension of the curve (0-1)

  // Turf bezier parameters (fallback)
  resolution: 10000,
  sharpness: 0.95,

  // Performance settings
  maxPoints: 50,

  // Data filtering
  minAgeSeconds: 30,
};

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

      // Filter pings first
      const coordinates = filterVesselPings(pings, currentPosition);

      // Skip if we don't have enough points or no current position
      if (!currentPosition || coordinates.length < 2) return acc;

      // Then apply smoothing
      const line = createSmoothedLine(coordinates, smoothingConfig.method, {
        tension: smoothingConfig.tension,
        resolution: smoothingConfig.resolution,
        sharpness: smoothingConfig.sharpness,
      });

      if (!line) return acc;

      const inService = pings[0]?.AtDock === false;

      // Set RGBA color based on service status
      // Pink-400 (244, 114, 182, 0.75) for vessels not at dock, white (255, 255, 255, 0.75) for vessels at dock
      const rgbaColor: [number, number, number, number] = inService
        ? [244, 114, 182, 0.75]
        : [255, 255, 255, 0.75];

      acc.push(
        <VesselLine
          key={`vessel-line-${vesselId}`}
          id={`vessel-${vesselId}`}
          line={line}
          inService={inService}
          rgbaColor={rgbaColor}
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
  // Filter pings first
  const coordinates = filterVesselPings(pings, currentPosition);

  // Skip if we don't have enough points or no current position
  if (!currentPosition || coordinates.length < 2) return null;

  // Then apply smoothing
  return createSmoothedLine(coordinates, smoothingConfig.method, {
    tension: smoothingConfig.tension,
    resolution: smoothingConfig.resolution,
    sharpness: smoothingConfig.sharpness,
  });
};
