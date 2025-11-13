/**
 * MapVesselMarker component
 *
 * Renders an individual vessel marker on the map with proper styling.
 * This component is responsible for the visual representation of a single vessel.
 */

import { Text, View } from "@/components/ui";
import type { VesselLocation } from "@/domain/vessels/vesselLocation";
import { useMapState } from "@/shared/contexts";
import { cn } from "@/shared/utils/cn";
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

const InServiceVesselMarker = ({ vessel }: { vessel: VesselLocation }) => {
  return (
    <View
      className={cn(
        "rounded-full border-[6px] justify-center items-center w-16 h-16 border-white",
        vessel.AtDock ? "bg-pink-200" : "bg-pink-400"
      )}
      style={shadowStyle}
    >
      {vessel.Heading && <VesselArrow vessel={vessel} />}
    </View>
  );
};

const OutOfServiceVesselMarker = () => (
  <View
    className="w-16 h-16 items-center justify-center bg-white/25 rounded-full border-[6px] border-white/50"
    style={shadowStyle}
  ></View>
);

const shadowStyle = {
  // iOS shadows
  shadowColor: "#000",
  shadowOffset: { width: 1, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3,

  // Android elevation
  elevation: 4,
};

const VesselArrow = ({ vessel }: { vessel: VesselWithProjection }) => {
  "use no memo";

  // Get map heading from context
  const { cameraState } = useMapState();

  // Convert compass heading (north = 0) to css rotation angle (east = 0), then adjust for map rotation
  const rotationAngle = vessel.Heading - cameraState.heading - 90;

  return (
    <View style={{ transform: [{ rotate: `${rotationAngle}deg` }] }}>
      <View className={cn(vessel.Speed > 0 ? "opacity-100" : "opacity-50")}>
        <Text className="text-white font-bold text-lg">{" )"}</Text>
      </View>
    </View>
  );
};
