/**
 * VesselMarkerContent component
 *
 * Renders visual representation of a vessel marker with appropriate styling
 * based on vessel state (in service, at dock, etc.). Includes direction
 * arrow for vessels that are in service.
 */

import { Text, View } from "@/components/ui";
import { useMapState } from "@/data/contexts";
import type { VesselLocation } from "@/domain";
import { cn } from "@/shared/utils/cn";

/**
 * VesselMarkerContent component
 *
 * Renders visual content of a vessel marker with styling based on vessel state.
 * Includes a directional arrow for vessels that are in service and have heading information.
 *
 * @param vessel - The vessel location data
 *
 * @returns A View component with styled vessel marker content
 */
export const VesselMarkerContent = ({ vessel }: { vessel: VesselLocation }) => {
  return (
    <View
      className={cn(
        "rounded-full border-[6px] justify-center items-center w-16 h-16 border-white",
        vessel.InService
          ? vessel.AtDock
            ? "bg-pink-200/75"
            : "bg-pink-400/75"
          : "bg-white/25"
      )}
      style={shadowStyle}
    >
      {vessel.InService && vessel.Heading && <VesselArrow vessel={vessel} />}
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

const VesselArrow = ({ vessel }: { vessel: VesselLocation }) => {
  "use no memo";

  // Get map heading from context
  const { cameraState } = useMapState();

  // Convert compass heading (north = 0) to css rotation angle (east = 0), then adjust for map rotation
  const rotationAngle = vessel.Heading - cameraState.heading - 90;

  return (
    <View style={{ transform: [{ rotate: `${rotationAngle}deg` }] }}>
      <View
        className={cn((vessel.Speed ?? 0) > 0 ? "opacity-100" : "opacity-50")}
      >
        <Text className="text-white font-bold text-lg">{" )"}</Text>
      </View>
    </View>
  );
};
