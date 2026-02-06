/**
 * TimelineBarAtSea component for rendering at-sea trip segments with distance-based progress.
 * Calculates progress based on departing and arriving distances.
 * Handles rocking animation for at-sea segments.
 */

import { useEffect } from "react";
import type { ViewStyle } from "react-native";
import { useSharedValue, withSpring } from "react-native-reanimated";
import { Text } from "@/components/ui";
import { useNowMs } from "@/shared/hooks";
import TimelineBar from "./TimelineBar";
import TimelineIndicator from "./TimelineIndicator";
import { TimelineSegment } from "./TimelineSegment";
import type { TimelineSegmentState } from "./types";
import { getTimelineLayout } from "./utils";

// ============================================================================
// Types
// ============================================================================

type TimelineBarAtSeaProps = {
  /**
   * Grouped temporal state for the segment.
   */
  state: TimelineSegmentState;
  /**
   * Distance from departing terminal in miles.
   */
  departingDistance?: number;
  /**
   * Distance to arriving terminal in miles.
   */
  arrivingDistance?: number;
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
 * Width allocation: Uses SchematicSegment (flexGrow + minWidth) to create
 * proportional widths across the timeline while ensuring legibility.
 *
 * Hold period: When isArrived is true, the indicator remains visible during
 * the 30-second hold period, showing "0 min" remaining instead of speed/distance.
 */
const TimelineBarAtSea = ({
  state,
  departingDistance,
  arrivingDistance,
  vesselName,
  speed = 0,
  barStyle = "h-3",
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
    status: state.status,
    nowMs,
    startTimeMs: state.startTimeMs,
    endTimeMs: state.endTimeMs,
    predictionEndTimeMs: state.predictionEndTimeMs,
  });

  // Calculate distance-based progress (only for at-sea segments)
  let progress = timeProgress;
  if (state.isArrived || state.isHeld) {
    progress = 1;
  } else if (
    state.status === "InProgress" &&
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

  // Render indicator during in-progress status, including the 30-second hold period after arrival
  const shouldShowIndicator =
    showIndicator ??
    (state.status === "InProgress" || state.isArrived || state.isHeld);

  return (
    <TimelineSegment duration={duration ?? 1} style={style}>
      <TimelineBar flexGrow={1} progress={progress} barStyle={barStyle} />
      {shouldShowIndicator && (
        <TimelineIndicator
          progress={animatedProgress}
          minutesRemaining={minutesRemaining ?? "--"}
          animate={animate}
          speed={speed}
        >
          {vesselName && (
            <Text className="text-sm font-bold leading-none font-playwrite pt-4">
              {vesselName}
            </Text>
          )}
          {!state.isArrived && arrivingDistance !== undefined && (
            <Text className="text-xs text-muted-foreground font-playwrite-light">
              {speed.toFixed(0)} kn · {arrivingDistance.toFixed(1)} mi
            </Text>
          )}
          {state.isArrived && (
            <Text className="text-xs text-muted-foreground font-playwrite-light">
              Arrived ❤️❤️❤️
            </Text>
          )}
        </TimelineIndicator>
      )}
    </TimelineSegment>
  );
};

export default TimelineBarAtSea;
