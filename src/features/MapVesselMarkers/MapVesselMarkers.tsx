/**
 * MapVesselMarkers component
 * Renders vessel markers on map using data from VesselLocations context
 */

import { Text, View } from "react-native";
import type { VesselLocation } from "ws-dottie/wsf-vessels";
import { type MapMarkerData, MapMarkers } from "@/features/MapMarkers";
import { useMapState, useWsDottie } from "@/shared/contexts";
import { VesselMarker } from "./VesselMarker";

/**
 * Extends VesselLocation to conform to MapMarkerData interface
 */
type VesselMarkerData = VesselLocation & MapMarkerData;

/**
 * Configuration constants for vessel markers
 */
const VESSEL_MARKER_CONFIG = {
  ZOOM_THRESHOLD: 8,
} as const;

/**
 * MapVesselMarkers component
 *
 * Fetches vessel data from the WsDottie context and renders markers on the map using the generic MapMarkers component.
 * Handles loading states, error states, and visibility based on zoom level.
 * Each vessel is rendered as a VesselMarker component with a blue circular indicator.
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
    vesselLocations.data?.map(vessel => ({
      ...vessel,
      id: vessel.VesselID.toString(), // Convert to string for MapMarkerData compatibility
      longitude: vessel.Longitude,
      latitude: vessel.Latitude,
    }));

  return (
    <MapMarkers
      data={vesselMarkerData}
      isLoading={vesselLocations.isLoading}
      isError={vesselLocations.isError}
      error={vesselLocations.error}
      zoomThreshold={VESSEL_MARKER_CONFIG.ZOOM_THRESHOLD}
      renderMarker={vessel => (
        <VesselMarker
          key={vessel.VesselID}
          vessel={vessel}
          onPress={onVesselPress}
        >
          <View className="w-5 h-5 bg-blue-500 rounded-full border-2 border-white justify-center items-center">
            <View className="w-2 h-2 bg-white rounded-full">
              <Text>Hi!</Text>
            </View>
          </View>
        </VesselMarker>
      )}
    />
  );
};
