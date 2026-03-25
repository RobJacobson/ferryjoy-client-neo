/**
 * Convenience screen wrapper for the VesselTimeline feature.
 */

import { View } from "@/components/ui";
import { GradientBackground } from "@/features/GradientBackground/GradientBackground";
import { getVesselTimelineDesignVariant } from "./designSystem";
import { VesselTimeline } from "./VesselTimeline";

type VesselTimelineScreenProps = {
  vesselAbbrev: string;
  sailingDay: string;
};

/**
 * Renders the vessel timeline as a full-screen feature.
 *
 * @param props - Screen props
 * @param props.vesselAbbrev - Vessel abbreviation to display
 * @param props.sailingDay - Sailing day in YYYY-MM-DD format
 * @returns Full-screen vessel timeline
 */
export const VesselTimelineScreen = ({
  vesselAbbrev,
  sailingDay,
}: VesselTimelineScreenProps) => {
  const variant = getVesselTimelineDesignVariant();

  return (
    <GradientBackground
      backgroundColor={variant.backgroundColor}
      colors={variant.backgroundColors}
    >
      <View className="flex-1">
        <VesselTimeline
          vesselAbbrev={vesselAbbrev}
          sailingDay={sailingDay}
          theme={variant.timelineTheme}
        />
      </View>
    </GradientBackground>
  );
};
