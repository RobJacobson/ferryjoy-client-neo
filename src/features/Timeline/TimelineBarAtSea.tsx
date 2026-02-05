/**
 * TimelineBarAtSea component for rendering at-sea trip segments with distance-based progress.
 * Calculates progress based on departing and arriving distances.
 * Handles rocking animation for at-sea segments.
 */

import { useEffect } from "react";
import type { ViewStyle } from "react-native";
import { View } from "react-native";
import { useSharedValue, withSpring } from "react-native-reanimated";
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
   * Whether the trip is currently being held in its completed state.
   */
  isHeld?: boolean;
  /**
   * Whether to explicitly show the progress indicator.
   * If provided, this overrides the default status-based visibility.
   */
  showIndicator?: boolean;
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
 *
 * Width allocation: The outer container uses flexGrow based on segment duration
 * to create proportional widths across the timeline. Inner TimelineBar fills its parent.
 *
 * Hold period: When isArrived is true, the indicator remains visible during
 * the 30-second hold period, showing "0 min" remaining instead of speed/distance.
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
  isHeld = false,
  showIndicator,
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
  if (isArrived || isHeld) {
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
    // Use withSpring for smooth transitions, but ensure it doesn't
    // overshoot or jump when transitioning to/from hold states.
    animatedProgress.value = withSpring(progress, {
      damping: 100,
      stiffness: 2,
      mass: 5,
      overshootClamping: true,
    });
  }, [progress, animatedProgress]);

  const flexGrow = duration ?? 1;

  // Render indicator during in-progress status, including the 30-second hold period after arrival
  const shouldShowIndicator =
    showIndicator ?? (status === "InProgress" || isArrived || isHeld);

  return (
    <View style={{ height: 32, flexGrow, ...style }} className="relative">
      <TimelineBar flexGrow={1} progress={progress} barStyle={barStyle} />
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
          {isArrived && (
            <Text className="text-xs text-muted-foreground">Arrived ❤️❤️❤️</Text>
          )}
        </TimelineIndicator>
      )}
    </View>
  );
};

export default TimelineBarAtSea;
