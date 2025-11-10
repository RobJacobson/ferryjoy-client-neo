/**
 * MapVesselMarker component
 *
 * Renders an individual vessel marker on the map with proper styling.
 * This component is responsible for the visual representation of a single vessel.
 */

import type { VesselLocation } from "ws-dottie/wsf-vessels";
import { Text, View } from "@/components/ui";
import { Marker, ScaledMarker } from "../MapMarkers";

/**
 * MapVesselMarker component
 *
 * Renders a single vessel marker with a circular background and vessel identifier.
 * The marker is styled with NativeWind classes to ensure consistent appearance
 * across platforms. The marker now uses perspective scaling and tilting based on
 * map pitch and position in viewport.
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
  onPress,
}: {
  vessel: VesselLocation;
  onPress?: (vessel: VesselLocation) => void;
}) => {
  const handlePress = () => {
    if (onPress) {
      onPress(vessel);
    }
  };

  return (
    <Marker longitude={vessel.Longitude} latitude={vessel.Latitude}>
      <ScaledMarker
        longitude={vessel.Longitude}
        latitude={vessel.Latitude}
        onPress={handlePress}
      >
        <View className="bg-pink-500 rounded-full border-2 border-white justify-center items-center w-16 h-16">
          <Text className="text-white font-bold text-lg">V</Text>
        </View>
      </ScaledMarker>
    </Marker>
  );
};
