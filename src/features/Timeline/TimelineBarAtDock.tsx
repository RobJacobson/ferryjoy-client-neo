/**
 * TimelineBarAtDock component for rendering at-dock segments with time-based progress.
 * Calculates progress automatically based on current time and start/end times.
 * Handles at-dock status labels.
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

type TimelineBarAtDockProps = {
  /**
   * Start time in milliseconds for progress calculation.
   */
  startTimeMs?: number;
  /**
   * End time in milliseconds for progress calculation.
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
   * Size of the circle markers in pixels.
   */
  circleSize?: number;
  /**
   * NativeWind className for the bar height.
   */
  barStyle?: string;
  /**
   * Optional terminal abbreviation to display when at dock (e.g., "At Dock SEA").
   */
  atDockAbbrev?: string;
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
   * Additional inline styles.
   */
  style?: ViewStyle;
};

// ============================================================================
// Component
// ============================================================================

/**
 * A component that renders an at-dock progress segment with time-based progress.
 * Calculates all business logic (progress, duration, what labels to show) and renders
 * using the presentation-only TimelineBar and TimelineIndicator components.
 * The TimelineBar and TimelineIndicator are siblings to allow proper z-index stacking.
 *
 * Width allocation: The outer container uses flexGrow based on segment duration
 * to create proportional widths across the timeline. Inner TimelineBar fills its parent.
 */
const TimelineBarAtDock = ({
  startTimeMs,
  endTimeMs,
  status,
  predictionEndTimeMs,
  vesselName,
  barStyle = "h-3",
  atDockAbbrev,
  isArrived = false,
  isHeld = false,
  showIndicator,
  style,
}: TimelineBarAtDockProps) => {
  const nowMs = useNowMs(1000);

  // Create a shared value for progress animation
  const animatedProgress = useSharedValue(0);

  // Calculate layout and progress
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

  const progress = isArrived ? 1 : timeProgress;

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
  const shouldShowIndicator =
    showIndicator ?? (status === "InProgress" && !isArrived && !isHeld);

  return (
    <View style={{ height: 32, flexGrow, ...style }} className="relative">
      <TimelineBar flexGrow={1} progress={progress} barStyle={barStyle} />
      {shouldShowIndicator && (
        <TimelineIndicator
          progress={animatedProgress}
          minutesRemaining={minutesRemaining ?? "--"}
        >
          {vesselName && (
            <Text className="text-sm font-semibold leading-none">
              {vesselName}
            </Text>
          )}
          {atDockAbbrev && (
            <Text className="text-xs text-muted-foreground">
              At Dock {atDockAbbrev}
            </Text>
          )}
        </TimelineIndicator>
      )}
    </View>
  );
};

export default TimelineBarAtDock;
