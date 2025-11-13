/**
 * VesselLines component
 *
 * Container component that manages and renders vessel track lines for all vessels.
 * Fetches vessel ping data from ConvexVesselPingsContext, processes data for each vessel,
 * and renders VesselLine components with appropriate styling.
 */

import type { Feature, LineString } from "geojson";
import type React from "react";
import type { VesselLocation } from "@/domain/vessels/vesselLocation";
import type { VesselPing } from "@/domain/vessels/vesselPing";
import { useConvexVesselPings } from "@/shared/contexts/ConvexVesselPingsContext";
import { useSmoothedVesselPositions } from "@/shared/contexts/SmoothedVesselPositionsContext";
import { filterVesselPings } from "./filtering";
import { createSmoothedLine, type SmoothingStrategyName } from "./smoothing";
import { VesselLine } from "./VesselLine";

// Configuration constants
const VESSEL_LINE_CONFIG = {
  // Smoothing strategy selection
  smoothingStrategy: "d3Basis" as SmoothingStrategyName, // Options: "d3Basis" | "d3Cardinal" | "d3CatmullRom" | "turfBezier"

  // Color configuration
  colors: {
    // Pink-400 with opacity for vessels in service
    inService: [244, 114, 182, 1] as [number, number, number, number],
    // White with opacity for vessels at dock
    atDock: [255, 255, 255, 0.5] as [number, number, number, number],
  },

  // Minimum number of points required to draw a line
  minPoints: 2,
} as const;

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

  // Process vessel data and create VesselLine components
  const vesselLineComponents = Object.entries(vesselPings)
    .map(([vesselId, pings]) => {
      const id = parseInt(vesselId, 10);
      const smoothedVessel = smoothedVessels.find((v) => v.VesselID === id);

      // Pass the entire smoothedVessel object instead of extracting coordinates
      const currentPosition = smoothedVessel;

      // Process vessel data to get smoothed line
      const line = processVesselData(pings, currentPosition);

      // Skip if we couldn't create a line
      if (!line) return null;

      // Determine if vessel is in service
      const inService = pings[0]?.AtDock === false;

      // Create and return VesselLine component
      return createVesselLineComponent(vesselId, line, inService);
    })
    .filter((component): component is React.ReactElement => component !== null);

  return <>{vesselLineComponents}</>;
};

/**
 * Determines the color for a vessel based on its service status
 * @param inService - Whether the vessel is currently in service
 * @returns RGBA color values for the vessel line
 */
const getVesselColor = (
  inService: boolean
): [number, number, number, number] =>
  inService
    ? VESSEL_LINE_CONFIG.colors.inService
    : VESSEL_LINE_CONFIG.colors.atDock;

/**
 * Processes vessel data to create a smoothed line
 * @param pings - Array of vessel ping data
 * @param currentPosition - Current smoothed position object
 * @returns Smoothed line or null if not enough points
 */
const processVesselData = (
  pings: VesselPing[],
  currentPosition?: VesselLocation
): Feature<LineString> | null => {
  // Filter pings first
  const coordinates = filterVesselPings(pings, currentPosition);

  // Skip if we don't have enough points or no current position
  if (!currentPosition || coordinates.length < VESSEL_LINE_CONFIG.minPoints) {
    return null;
  }

  // Apply smoothing with selected strategy
  return createSmoothedLine(coordinates, VESSEL_LINE_CONFIG.smoothingStrategy);
};

/**
 * Creates a VesselLine component for a vessel
 * @param vesselId - ID of the vessel
 * @param line - Smoothed line data
 * @param inService - Whether the vessel is in service
 * @returns VesselLine component
 */
const createVesselLineComponent = (
  vesselId: string,
  line: Feature<LineString>,
  inService: boolean
): React.ReactElement => {
  const rgbaColor = getVesselColor(inService);

  return (
    <VesselLine
      key={`vessel-line-${vesselId}`}
      id={`vessel-${vesselId}`}
      line={line}
      inService={inService}
      rgbaColor={rgbaColor}
    />
  );
};
