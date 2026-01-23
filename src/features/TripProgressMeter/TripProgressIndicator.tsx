/**
 * TripProgressIndicator component for rendering a progress indicator overlay
 * that displays minutes remaining in a circular badge.
 */

import { View } from "react-native";
import { Text } from "@/components/ui";
import TripProgressCircle from "./TripProgressCircle";

// ============================================================================
// Types
// ============================================================================

type TripProgressIndicatorProps = {
  /**
   * Progress value (0-1) for horizontal positioning within the parent bar.
   */
  progress: number;
  /**
   * Minutes remaining to display in the indicator.
   */
  minutesRemaining: number;
  /**
   * Optional z-index for stacking order.
   */
  zIndex?: number;
};

// ============================================================================
// Component
// ============================================================================

/**
 * Renders a progress indicator positioned based on progress value within the parent bar.
 * The indicator is absolutely positioned and displays the minutes remaining.
 *
 * @param progress - Progress value (0-1) for horizontal positioning
 * @param minutesRemaining - Minutes remaining to display
 * @param zIndex - Optional z-index for stacking order
 * @returns A View component containing the indicator
 */
const TripProgressIndicator = ({
  progress,
  minutesRemaining,
  zIndex,
}: TripProgressIndicatorProps) => {
  return (
    <TripProgressCircle
      left={`${progress * 100}%`}
      backgroundColor="bg-pink-500"
      borderColor=""
      size={32}
      zIndex={zIndex}
    >
      <View className="border border-white p-1 rounded-full w-full items-center justify-center">
        <Text className="text-sm font-semibold text-white">
          {minutesRemaining > 99 ? "--" : minutesRemaining}
        </Text>
      </View>
    </TripProgressCircle>
  );
};

export default TripProgressIndicator;
