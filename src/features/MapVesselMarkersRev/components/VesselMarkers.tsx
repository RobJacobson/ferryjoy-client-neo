/**
 * VesselMarkers component
 *
 * Renders a collection of vessel markers on the map using smoothed vessel positions.
 * Handles z-index ordering based on vessel service status.
 */

import { useSmoothedVesselPositions } from "@/shared/contexts";
import { VesselMarker } from "./VesselMarker";

/**
 * Configuration constants for vessel markers
 */
const VESSEL_MARKER_CONFIG = {
  OUT_OF_SERVICE_Z_INDEX: 1,
  IN_SERVICE_Z_INDEX: 2,
} as const;

/**
 * VesselMarkers component
 *
 * Fetches smoothed vessel position data from SmoothedVesselPositions context and renders
 * markers on the map. The smoothed positions provide fluid animation between GPS updates
 * using exponential smoothing. Handles z-index ordering based on service status.
 * In-service vessels are rendered with a higher z-index to appear above out-of-service vessels.
 *
 * @returns React elements representing vessel markers
 */
export const VesselMarkers = () => {
  const { smoothedVessels } = useSmoothedVesselPositions();

  return (
    <>
      {smoothedVessels.map((vessel) => (
        <VesselMarker
          key={vessel.VesselID}
          vessel={vessel}
          zIndex={
            vessel.InService
              ? VESSEL_MARKER_CONFIG.IN_SERVICE_Z_INDEX
              : VESSEL_MARKER_CONFIG.OUT_OF_SERVICE_Z_INDEX
          }
        />
      ))}
    </>
  );
};
