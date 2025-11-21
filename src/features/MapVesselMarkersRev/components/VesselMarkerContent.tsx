/**
 * VesselMarkerContent component
 *
 * Renders visual representation of a vessel marker with appropriate styling
 * based on vessel state (in service, at dock, etc.). Includes direction
 * arrow for vessels that are in service.
 */

import { View } from "@/components/ui";
import type { VesselLocation } from "@/domain";
import { VesselArrow } from "./VesselArrow";

// Inline type definition for VesselMarkerContent props
interface VesselMarkerContentProps {
  /** The vessel location data */
  vessel: VesselLocation;

  /** Scale factor for the marker */
  scale: number;

  /** Style object containing container and shadow styles */
  style: {
    container: string;
    shadow: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
  };

  /** Optional callback function triggered when the vessel marker is pressed */
  onPress?: (vessel: VesselLocation) => void;
}

/**
 * VesselMarkerContent component
 *
 * Renders visual content of a vessel marker with styling based on vessel state.
 * Applies scaling and shadow effects, and includes a directional arrow for
 * vessels that are in service and have heading information.
 *
 * @param vessel - The vessel location data
 * @param scale - Scale factor for the marker
 * @param style - Style object with container and shadow styles
 * @param onPress - Optional callback function triggered when the vessel marker is pressed
 *
 * @returns A View component with styled vessel marker content
 */
export const VesselMarkerContent = ({
  vessel,
  scale,
  style,
  onPress,
}: VesselMarkerContentProps) => {
  const arrowElement =
    vessel.InService && vessel.Heading ? <VesselArrow vessel={vessel} /> : null;

  return (
    <View
      className={style.container}
      style={[style.shadow, { transform: [{ scale }] }]}
      onTouchEnd={() => onPress?.(vessel)}
    >
      {arrowElement}
    </View>
  );
};
