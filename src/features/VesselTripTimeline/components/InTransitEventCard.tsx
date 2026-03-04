/**
 * Presentational card for in-transit vessel status content.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import { Text, View } from "@/components/ui";

type InTransitEventCardProps = {
  vesselLocation: VesselLocation;
};

/**
 * Renders in-transit event content for a timeline row.
 *
 * @param vesselLocation - Vessel location used for status details
 * @returns In-transit event card
 */
export const InTransitEventCard = ({
  vesselLocation,
}: InTransitEventCardProps) => {
  const speedText = `${Math.round(vesselLocation.Speed)} kn`;
  const subtitle =
    typeof vesselLocation.ArrivingDistance === "number"
      ? `${speedText} · ${vesselLocation.ArrivingDistance.toFixed(1)} mi to destination`
      : `${speedText} · In transit`;

  return (
    <View className="bg-green-200">
      <Text className="font-semibold text-base">
        {vesselLocation.VesselName}
      </Text>
      <Text className="text-muted-foreground text-sm">{subtitle}</Text>
    </View>
  );
};
