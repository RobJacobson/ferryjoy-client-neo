/**
 * TimelineBarAtSea component for rendering at-sea trip segments with distance-based progress.
 * Calculates progress based on departing and arriving distances.
 * Handles rocking animation for at-sea segments.
 */

import { useEffect } from "react";
import type { ViewStyle } from "react-native";
import { View } from "react-native";
import Animated, {
  type SharedValue,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Text } from "@/components/ui";
import { useNowMs } from "@/shared/hooks";
import TimelineBar from "./TimelineBar";
import TimelineIndicator from "./TimelineIndicator";
import { getTimelineLayout } from "./utils";

// ============================================================================
// Types
// ============================================================================

type TimelineBarAtSeaProps = {
  /**
   * Distance from departing terminal in miles.
   */
  departingDistance?: number;
  /**
   * Distance to arriving terminal in miles.
   */
  arrivingDistance?: number;
  /**
   * Start time in milliseconds (used for flex-grow width allocation).
   */
  startTimeMs?: number;
  /**
   * End time in milliseconds (used for flex-grow and minutes remaining).
   */
  endTimeMs?: number;
  /**
   * Status of the progress bar segment.
   */
  status: "Pending" | "InProgress" | "Completed";
  /**
   * Optional prediction for the end time of this segment.
   * If provided, progress will be calculated against this instead of endTimeMs
   * when the vessel is delayed.
   */
  predictionEndTimeMs?: number;
  /**
   * Optional vessel name to display above the progress indicator.
   */
  vesselName?: string;
  /**
   * Current speed of the vessel in knots.
   */
  speed?: number;
  /**
   * Size of the circle markers in pixels.
   */
  circleSize?: number;
  /**
   * NativeWind className for the bar height.
   */
  barStyle?: string;
  /**
   * Whether the vessel has arrived at its destination terminal.
   */
  isArrived?: boolean;
  /**
   * Whether to animate the progress indicator with a rocking motion.
   */
  animate?: boolean;
  /**
   * Additional inline styles.
   */
  style?: ViewStyle;
};

// ============================================================================
// Component
// ============================================================================

/**
 * A component that renders an at-sea progress segment with distance-based progress.
 * Calculates all business logic (progress, duration) and renders
 * using the presentation-only TimelineBar and TimelineIndicator components.
 * The TimelineBar and TimelineIndicator are siblings to allow proper z-index stacking.
 */
const TimelineBarAtSea = ({
  departingDistance,
  arrivingDistance,
  startTimeMs,
  endTimeMs,
  status,
  predictionEndTimeMs,
  vesselName,
  speed = 0,
  barStyle = "h-3",
  isArrived = false,
  animate = false,
  style,
}: TimelineBarAtSeaProps) => {
  const nowMs = useNowMs(1000);

  // Create a shared value for progress animation
  const animatedProgress = useSharedValue(0);

  // Calculate layout values (duration for flex-grow, minutesRemaining for label)
  const {
    progress: timeProgress,
    minutesRemaining,
    duration,
  } = getTimelineLayout({
    status,
    nowMs,
    startTimeMs,
    endTimeMs,
    predictionEndTimeMs,
  });

  // Calculate distance-based progress (only for at-sea segments)
  let progress = timeProgress;
  if (isArrived) {
    progress = 1;
  } else if (
    status === "InProgress" &&
    departingDistance !== undefined &&
    arrivingDistance !== undefined &&
    departingDistance + arrivingDistance > 0
  ) {
    // Progress = DepartingDistance / (DepartingDistance + ArrivingDistance)
    progress = departingDistance / (departingDistance + arrivingDistance);
    // Clamp between 0 and 1
    progress = Math.min(1, Math.max(0, progress));
  }

  // Update the animated value whenever the progress prop changes
  useEffect(() => {
    animatedProgress.value = withSpring(progress, {
      damping: 100,
      stiffness: 2,
      mass: 5,
      overshootClamping: true,
    });
  }, [progress, animatedProgress]);

  const flexGrow = duration ?? 1;

  // Only render indicator when actively at sea (not arrived)
  const shouldShowIndicator = status === "InProgress" && !isArrived;

  return (
    <View style={{ height: 32, ...style }} className="relative flex-1">
      <TimelineBar
        flexGrow={flexGrow}
        progress={progress}
        barStyle={barStyle}
      />
      {shouldShowIndicator && (
        <TimelineIndicator
          progress={animatedProgress}
          minutesRemaining={minutesRemaining ?? "--"}
          animate={animate}
          speed={speed}
        >
          {vesselName && (
            <Text className="text-sm font-semibold leading-none">
              {vesselName}
            </Text>
          )}
          {!isArrived && arrivingDistance !== undefined && (
            <Text className="text-xs text-muted-foreground">
              {speed.toFixed(0)} kn · {arrivingDistance.toFixed(1)} mi
            </Text>
          )}
        </TimelineIndicator>
      )}
    </View>
  );
};

export default TimelineBarAtSea;
