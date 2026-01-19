/**
 * TripProgressIndicator component for rendering a progress indicator overlay
 * that displays minutes remaining in a circular badge.
 */

import { View } from "react-native";
import { Text } from "@/components/ui";
import { STACKING } from "./config";
import TripProgressCircle from "./TripProgressCircle";
import type { TripProgressIndicatorModel } from "./useTripProgressMeterModel";

// ============================================================================
// Types
// ============================================================================

type TripProgressIndicatorProps = {
  /**
   * Indicator model to render, or null to hide the indicator.
   */
  indicatorModel: TripProgressIndicatorModel | null;
};

// ============================================================================
// Component
// ============================================================================

/**
 * Renders an absolute overlay (pointer-events none) containing the progress indicator.
 * This must be rendered inside the meter container to ensure the correct stacking
 * above bars and markers.
 *
 * @param indicatorModel - Indicator model to render, or null to hide
 * @returns A View overlay containing the indicator when present
 */
const TripProgressIndicator = ({
  indicatorModel,
}: TripProgressIndicatorProps) => {
  if (!indicatorModel) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: STACKING.progressCircle,
        elevation: STACKING.progressCircle,
      }}
    >
      <TripProgressCircle
        left={`${indicatorModel.leftPercent}%`}
        backgroundColor="bg-pink-500"
        borderColor=""
        size={32}
        zIndex={STACKING.progressCircle}
      >
        <View className="border border-white p-1 rounded-full w-full items-center justify-center">
          <Text className="text-sm font-semibold text-white">
            {indicatorModel.minutesRemaining > 99 ? "--" : indicatorModel.minutesRemaining}
          </Text>
        </View>
      </TripProgressCircle>
    </View>
  );
};

export default TripProgressIndicator;
