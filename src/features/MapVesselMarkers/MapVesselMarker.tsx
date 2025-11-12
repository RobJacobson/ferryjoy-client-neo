/**
 * MapVesselMarker component
 *
 * Renders an individual vessel marker on the map with proper styling.
 * This component is responsible for the visual representation of a single vessel.
 */

import Animated from "react-native-reanimated";
import type { VesselLocation } from "ws-dottie/wsf-vessels";
import { Text, View } from "@/components/ui";
import { useMapState, type VesselWithProjection } from "@/shared/contexts";
import { useVesselPulseAnimation } from "@/shared/hooks";
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
  zIndex,
}: {
  vessel: VesselWithProjection;
  zIndex?: number;
}) => {
  return (
    <Marker
      longitude={vessel.Longitude}
      latitude={vessel.Latitude}
      zIndex={zIndex}
    >
      <ScaledMarker longitude={vessel.Longitude} latitude={vessel.Latitude}>
        {vessel.InService ? (
          <InServiceVesselMarker vessel={vessel} />
        ) : (
          <OutOfServiceVesselMarker />
        )}
      </ScaledMarker>
    </Marker>
  );
};

const InServiceVesselMarker = ({
  vessel,
}: {
  vessel: VesselWithProjection;
}) => {
  return (
    <View
      className="bg-pink-400 rounded-full border-4 border-white justify-center items-center w-16 h-16"
      style={shadowStyle}
    >
      {vessel.Heading && <VesselArrow vessel={vessel} />}
    </View>
  );
};

const shadowStyle = {
  // iOS shadows
  shadowColor: "#000",
  shadowOffset: { width: 1, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3,

  // Android elevation
  elevation: 4,
};

const OutOfServiceVesselMarker = () => {
  return (
    <View
      className="bg-pink-500/10 rounded-full border-4 border-white/50 justify-center items-center w-16 h-16"
      style={shadowStyle}
    />
  );
};

const VesselArrow = ({ vessel }: { vessel: VesselLocation }) => {
  "use no memo";

  // Get map heading from context
  const { cameraState } = useMapState();

  // Apply pulsing animation based on vessel speed
  const animatedStyle = useVesselPulseAnimation(vessel.Speed || 0);

  // Convert compass heading (north = 0) to css rotation angle (east = 0), then adjust for map rotation
  const rotationAngle = vessel.Heading - cameraState.heading - 90;

  return (
    <View style={{ transform: [{ rotate: `${rotationAngle}deg` }] }}>
      <Animated.View style={animatedStyle}>
        <Text className="text-white font-bold text-lg">{" )"}</Text>
      </Animated.View>
    </View>
  );
};
