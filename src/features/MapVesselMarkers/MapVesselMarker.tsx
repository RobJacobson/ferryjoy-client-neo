/**
 * MapVesselMarker component
 *
 * Renders an individual vessel marker on the map with proper styling.
 * This component is responsible for the visual representation of a single vessel.
 */

import type { VesselLocation } from "ws-dottie/wsf-vessels";
import { Text, View } from "@/components/ui";
import { useMapState } from "@/shared/contexts";
import { Marker } from "../MapMarkers";

/**
 * MapVesselMarker component
 *
 * Renders a single vessel marker with a circular background and vessel identifier.
 * The marker is styled with NativeWind classes to ensure consistent appearance
 * across platforms.
 *
 * @param vessel - The vessel location data containing coordinates and vessel information
 * @param onPress - Optional callback function triggered when the vessel marker is pressed
 *
 * @returns A VesselMarker component with styled vessel marker
 *
 * @example
 * ```tsx
 * // Basic usage
 * <MapVesselMarker vessel={vessel} />
 *
 * // With press handler
 * <MapVesselMarker
 *   vessel={vessel}
 *   onPress={(v) => showVesselDetails(v.VesselID)}
 * />
 * ```
 */
export const MapVesselMarker = ({
  vessel,
}: {
  vessel: VesselLocation;
  onPress?: (vessel: VesselLocation) => void;
}) => {
  const { zoom } = useMapState();
  const scale = zoom * 0.1;
  return (
    <Marker longitude={vessel.Longitude} latitude={vessel.Latitude}>
      <View className="w-8 h-8 bg-pink-500 rounded-full border-2 border-white justify-center items-center">
        <Text className="text-white text-xs font-bold">V</Text>
      </View>
    </Marker>
  );
};
