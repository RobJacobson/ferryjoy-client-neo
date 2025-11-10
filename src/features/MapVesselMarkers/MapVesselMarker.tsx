/**
 * MapVesselMarker component
 *
 * Renders an individual vessel marker on the map with proper styling.
 * This component is responsible for the visual representation of a single vessel.
 */

import type { VesselLocation } from "ws-dottie/wsf-vessels";
import { Text, View } from "@/components/ui";
import { useMapState } from "@/shared/contexts";
import { Marker, ScaledMarker } from "../MapMarkers";

/**
 * MapVesselMarker component
 *
 * Renders a single vessel marker with a circular background and vessel identifier.
 * The marker is styled with NativeWind classes to ensure consistent appearance
 * across platforms. The marker now uses perspective scaling and tilting based on
 * map pitch and position in viewport, and rotates to align with vessel direction.
 *
 * @param vessel - The vessel location data containing coordinates and vessel information
 * @param onPress - Optional callback function triggered when the vessel marker is pressed
 * @param zIndex - Optional z-index value to control stacking order of markers
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
  onPress: _onPress,
  zIndex = 1,
}: {
  vessel: VesselLocation;
  onPress?: (vessel: VesselLocation) => void;
  zIndex?: number;
}) => {
  // Note: onPress is intentionally not used in this component but kept for API compatibility
  return (
    <Marker
      longitude={vessel.Longitude}
      latitude={vessel.Latitude}
      zIndex={zIndex}
    >
      <ScaledMarker longitude={vessel.Longitude} latitude={vessel.Latitude}>
        {vessel.InService ? (
          <InServiceVessel vessel={vessel} />
        ) : (
          <OutOfServiceVessel _vessel={vessel} />
        )}
      </ScaledMarker>
    </Marker>
  );
};

const InServiceVessel = ({ vessel }: { vessel: VesselLocation }) => (
  <View className="bg-pink-500 rounded-full border-2 border-white justify-center items-center w-16 h-16">
    {vessel.InService && <VesselArrow vessel={vessel} />}
  </View>
);

const VesselArrow = ({ vessel }: { vessel: VesselLocation }) => {
  // Get map heading from context
  const { cameraState } = useMapState();

  // Convert compass heading (north = 0) to css rotation angle (east = 0)
  // Then subtract map heading to account for map rotation
  const vesselHeading = vessel.Heading !== null ? vessel.Heading - 90 : 0;
  const rotationAngle = vesselHeading - cameraState.heading;

  return (
    <View style={{ transform: [{ rotate: `${rotationAngle}deg` }] }}>
      <Text className="text-white/50 font-bold text-lg">❯</Text>
    </View>
  );
};

const OutOfServiceVessel = ({ _vessel }: { _vessel: VesselLocation }) => (
  <View className="bg-pink-500/20 rounded-full border-2 border-white/50 justify-center items-center w-16 h-16"></View>
);
