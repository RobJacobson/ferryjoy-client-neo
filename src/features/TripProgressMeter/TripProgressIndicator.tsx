/**
 * TripProgressIndicator component for rendering a portaled progress indicator
 * that displays minutes remaining in a circular badge. Used by TripProgressBar
 * to show progress position and time remaining when a trip is in progress.
 */

import { Portal } from "@rn-primitives/portal";
import { View } from "react-native";
import { Text } from "@/components/ui";
import { STACKING } from "./config";
import { calculateMinutesRemaining } from "./TripProgressBar";
import TripProgressCircle from "./TripProgressCircle";

// ============================================================================
// Types
// ============================================================================

type TripProgressIndicatorProps = {
  /**
   * Unique portal name for this indicator (required when portalHostName is set).
   */
  portalName: string;
  /**
   * Portal host name for rendering the indicator above other elements.
   */
  portalHostName: string;
  /**
   * Left position as a percentage (0-100) for the indicator.
   */
  indicatorLeftPercent: number;
  /**
   * End time in epoch milliseconds for calculating minutes remaining.
   */
  endTimeMs?: number;
  /**
   * Current time in epoch milliseconds for calculating minutes remaining.
   */
  currentTimeMs: number;
};

// ============================================================================
// Component
// ============================================================================

/**
 * Renders a portaled progress indicator showing minutes remaining in a circular badge.
 * The indicator is positioned at the specified left percentage and rendered via portal
 * to appear above other components in the progress meter. Minutes remaining is calculated
 * internally from the provided time values.
 *
 * @param portalName - Unique portal name for this indicator
 * @param portalHostName - Portal host name for rendering above other elements
 * @param indicatorLeftPercent - Left position as percentage (0-100)
 * @param endTimeMs - End time in epoch milliseconds for calculating minutes remaining
 * @param currentTimeMs - Current time in epoch milliseconds for calculating minutes remaining
 * @returns A Portal containing the progress indicator circle
 */
const TripProgressIndicator = ({
  portalName,
  portalHostName,
  indicatorLeftPercent,
  endTimeMs,
  currentTimeMs,
}: TripProgressIndicatorProps) => {
  const minutesRemaining = calculateMinutesRemaining(endTimeMs, currentTimeMs);

  return (
    <Portal name={portalName} hostName={portalHostName}>
      <TripProgressCircle
        left={`${indicatorLeftPercent}%`}
        backgroundColor="bg-pink-500"
        borderColor=""
        size={32}
        zIndex={STACKING.progressCircle}
      >
        <View className="border border-white p-1 rounded-full w-full items-center justify-center">
          <Text className="text-sm font-semibold text-white">
            {minutesRemaining}
          </Text>
        </View>
      </TripProgressCircle>
    </Portal>
  );
};

export default TripProgressIndicator;
