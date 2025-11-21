/**
 * MapVesselMarkers component
 * Renders vessel markers on map using smoothed animated vessel positions
 */

import type { VesselLocation } from "@/domain";
import { type MapMarkerData, MapMarkers } from "@/features/MapMarkers";
import { useSmoothedVesselPositions } from "@/shared/contexts";
import { MapVesselMarker } from "./MapVesselMarker";

/**
 * Extends VesselLocation to conform to MapMarkerData interface
 */
type VesselMarkerData = VesselLocation & MapMarkerData;

/**
 * Configuration constants for vessel markers
 */
const VESSEL_MARKER_CONFIG = {
  ZOOM_THRESHOLD: 8,
  OUT_OF_SERVICE_Z_INDEX: 1,
  IN_SERVICE_Z_INDEX: 2,
} as const;

/**
 * MapVesselMarkers component
 *
 * Fetches smoothed vessel position data from SmoothedVesselPositions context and renders markers on the map using the generic MapMarkers component.
 * The smoothed positions provide fluid animation between GPS updates using exponential smoothing.
 * Handles visibility based on zoom level.
 * Each vessel is rendered as a MapVesselMarker with appropriate styling based on service status.
 * In-service vessels are rendered with a higher z-index to appear above out-of-service vessels.
 *
 * @returns React elements representing vessel markers or null if vessels should not be displayed
 *
 * @example
 * ```tsx
 * // Basic usage
 * <MapVesselMarkers />
 * ```
 */
export const MapVesselMarkers = () => {
  const { smoothedVessels } = useSmoothedVesselPositions();

  // Transform vessel data to conform to MapMarkerData
  const vesselMarkerData: VesselMarkerData[] =
    smoothedVessels.map(toVesselMarkerData);

  return (
    <MapMarkers
      data={vesselMarkerData}
      renderMarker={(vessel) => (
        <MapVesselMarker
          key={vessel.VesselID}
          vessel={vessel}
          zIndex={
            vessel.InService
              ? VESSEL_MARKER_CONFIG.IN_SERVICE_Z_INDEX
              : VESSEL_MARKER_CONFIG.OUT_OF_SERVICE_Z_INDEX
          }
        />
      )}
    />
  );
};

const toVesselMarkerData = (vessel: VesselLocation): VesselMarkerData => {
  return {
    ...vessel,
    id: vessel.VesselID.toString(),
    longitude: vessel.Longitude,
    latitude: vessel.Latitude,
  };
};
