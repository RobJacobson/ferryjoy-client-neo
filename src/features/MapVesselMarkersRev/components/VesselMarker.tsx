/**
 * VesselMarker component
 *
 * Main component for rendering a vessel marker on the map. Handles positioning,
 * scaling, and delegates visual rendering to VesselMarkerContent.
 */

import type { VesselLocation } from "@/domain";
import { cn } from "@/shared/utils/cn";
import { useVesselMarkerScale } from "../hooks/useVesselMarkerScale";
import { Marker } from "../platform";
import { VesselMarkerContent } from "./VesselMarkerContent";

// Inline type definition for VesselMarker props
interface VesselMarkerProps {
  /** The vessel location data */
  vessel: VesselLocation;

  /** Optional callback function triggered when the vessel marker is pressed */
  onPress?: (vessel: VesselLocation) => void;

  /** Optional z-index value to control the stacking order of markers */
  zIndex?: number;
}

/**
 * VesselMarker component
 *
 * Renders a vessel marker at the specified coordinates with appropriate styling
 * and scaling based on vessel state and map properties. This component combines
 * positioning logic with visual representation.
 *
 * @param vessel - The vessel location data
 * @param onPress - Optional callback function triggered when the vessel marker is pressed
 * @param zIndex - Optional z-index value to control the stacking order of markers
 *
 * @returns A Marker component containing vessel marker content
 */
export const VesselMarker = ({
  vessel,
  onPress,
  zIndex,
}: VesselMarkerProps) => {
  const markerScale = useVesselMarkerScale(vessel);

  // Inline style calculation instead of using a hook
  const markerStyle = {
    container: cn(
      "rounded-full border-[6px] justify-center items-center w-16 h-16 border-white",
      vessel.InService
        ? vessel.AtDock
          ? "bg-pink-200"
          : "bg-pink-400"
        : "bg-white/25 border-white/50"
    ),
    shadow: {
      // iOS shadows
      shadowColor: "#000",
      shadowOffset: { width: 1, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3,

      // Android elevation
      elevation: 4,
    },
  };

  return (
    <Marker
      longitude={vessel.Longitude}
      latitude={vessel.Latitude}
      zIndex={zIndex}
    >
      <VesselMarkerContent
        vessel={vessel}
        scale={markerScale}
        style={markerStyle}
        onPress={onPress}
      />
    </Marker>
  );
};
