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
  const backgroundColor = vessel.InService
    ? vessel.AtDock
      ? "bg-pink-200"
      : "bg-pink-400"
    : "bg-white/25";
  const borderColor = vessel.InService
    ? vessel.AtDock
      ? "border-pink-200"
      : "border-pink-400"
    : "border-white";
  return (
    <View className={cn("rounded-full border-[0.5px]", borderColor)}>
      <View
        className={cn(
          "h-20 w-20 items-center justify-center rounded-full border-[6px]",
          backgroundColor,
          vessel.InService ? "border-white" : "border-white/50"
        )}
        style={shadowStyle}
      >
        {vessel.InService && vessel.Heading && <VesselArrow vessel={vessel} />}
      </View>
    </View>
  );
};

const shadowStyle = {
  // iOS shadows
  shadowColor: "#000",
  shadowOffset: { width: 2, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 6,

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
        <Text className="font-bold text-lg text-white">{" )"}</Text>
      </View>
    </View>
  );
};
