/**
 * MapVesselMarkers component
 * Renders vessel markers on map using data from VesselLocations context
 */

import type { VesselLocation } from "ws-dottie/wsf-vessels";
import { type MapMarkerData, MapMarkers } from "@/features/MapMarkers";
import { useMapState, useWsDottie } from "@/shared/contexts";
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
 * Fetches vessel data from the WsDottie context and renders markers on the map using the generic MapMarkers component.
 * Handles loading states, error states, and visibility based on zoom level.
 * Each vessel is rendered as a MapVesselMarker component with a pink circular indicator.
 * In-service vessels are rendered with a higher z-index to appear above out-of-service vessels.
 *
 * @param onVesselPress - Optional callback function triggered when a vessel marker is pressed
 *
 * @returns React elements representing vessel markers or null if vessels should not be displayed
 *
 * @example
 * ```tsx
 * // Basic usage without press handler
 * <MapVesselMarkers />
 *
 * // With press handler
 * <MapVesselMarkers
 *   onVesselPress={(vessel) => navigation.navigate('VesselDetails', { vesselId: vessel.VesselID })}
 * />
 * ```
 */
export const MapVesselMarkers = ({
  onVesselPress,
}: {
  onVesselPress?: (vessel: VesselLocation) => void;
}) => {
  const { vesselLocations } = useWsDottie();

  // Transform vessel data to conform to MapMarkerData if needed
  const vesselMarkerData: VesselMarkerData[] | undefined =
    vesselLocations.data?.map(toVesselMarkerData);

  // Separate vessels into in-service and out-of-service groups
  const inServiceVessels =
    vesselMarkerData?.filter(vessel => vessel.InService) || [];
  const outOfServiceVessels =
    vesselMarkerData?.filter(vessel => !vessel.InService) || [];

  return (
    <>
      {/* Render out-of-service vessels first with lower z-index */}
      <MapMarkers
        data={outOfServiceVessels}
        renderMarker={vessel => (
          <MapVesselMarker
            key={vessel.VesselID}
            vessel={vessel}
            onPress={onVesselPress}
            zIndex={VESSEL_MARKER_CONFIG.OUT_OF_SERVICE_Z_INDEX}
          />
        )}
      />
      {/* Render in-service vessels second with higher z-index */}
      <MapMarkers
        data={inServiceVessels}
        renderMarker={vessel => (
          <MapVesselMarker
            key={vessel.VesselID}
            vessel={vessel}
            onPress={onVesselPress}
            zIndex={VESSEL_MARKER_CONFIG.IN_SERVICE_Z_INDEX}
          />
        )}
      />
    </>
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
