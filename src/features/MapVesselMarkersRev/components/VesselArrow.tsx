/**
 * VesselArrow component
 *
 * Renders a directional arrow indicator for a vessel based on its heading.
 * The arrow rotates to align with vessel's direction and adjusts opacity
 * based on vessel speed.
 */

import { Text, View } from "@/components/ui";
import type { VesselLocation } from "@/domain";
import { useMapState } from "@/shared/contexts";
import { cn } from "@/shared/utils/cn";

// Inline type definition for VesselArrow props
interface VesselArrowProps {
  /** The vessel location data */
  vessel: VesselLocation;
}

/**
 * VesselArrow component
 *
 * Renders a directional arrow that rotates based on vessel heading and map rotation.
 * The arrow's opacity indicates whether vessel is moving (full opacity) or
 * stationary (reduced opacity).
 *
 * @param vessel - The vessel location data containing heading and speed information
 *
 * @returns A View component with a rotated arrow text indicator
 */
export const VesselArrow = ({ vessel }: VesselArrowProps) => {
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
