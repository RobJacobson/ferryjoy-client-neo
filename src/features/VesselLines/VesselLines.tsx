/**
 * VesselLines component
 *
 * Container component that manages and renders vessel track lines for all vessels.
 * Fetches vessel ping data from ConvexVesselPingsContext, processes data for each vessel,
 * and renders VesselLine components with appropriate styling.
 */

import { bezierSpline, lineString } from "@turf/turf";
import type React from "react";
import { smoothingConfig } from "@/config/smoothingConfig";
import type { VesselPing } from "@/domain/vessels/vesselPing";
import { useConvexVesselPings } from "@/shared/contexts/ConvexVesselPingsContext";
import { useSmoothedVesselPositions } from "@/shared/contexts/SmoothedVesselPositionsContext";
import { createSmoothedLineWithD3 } from "@/shared/utils/d3CurveSmoothing";
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
  // Filter out pings that are less than the configured minimum age
  const minAgeMs = smoothingConfig.minAgeSeconds * 1000;
  const cutoffTime = new Date(Date.now() - minAgeMs);
  const filteredPings = pings.filter((ping) => ping.TimeStamp <= cutoffTime);

  // Skip if we don't have enough points for a line after filtering
  if (!filteredPings || filteredPings.length < 2) {
    return null;
  }

  // Convert to GeoJSON LineString coordinates [longitude, latitude]
  let coordinates = filteredPings.map((ping) => [
    ping.Longitude,
    ping.Latitude,
  ]);

  // Prepend the current smoothed position if provided
  if (currentPosition) {
    coordinates = [currentPosition, ...coordinates];
  }

  // Apply the maxPoints limit after potentially adding the current position
  if (coordinates.length > smoothingConfig.maxPoints) {
    coordinates = coordinates.slice(0, smoothingConfig.maxPoints);
  }

  // Use the configured smoothing method
  switch (smoothingConfig.method) {
    case "d3-basis":
      return createSmoothedLineWithD3(pings, currentPosition);
    case "turf-bezier":
    default: {
      // Fallback to original bezierSpline with config parameters
      const line = lineString(coordinates);
      const smoothed = bezierSpline(line, {
        resolution: smoothingConfig.resolution,
        sharpness: smoothingConfig.sharpness,
      });
      return smoothed;
    }
  }
};
