/**
 * TimelineBarAtDock component for rendering at-dock segments with time-based progress.
 * Calculates progress automatically based on current time and start/end times.
 * Handles at-dock status labels.
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

type TimelineBarAtDockProps = {
  /**
   * Grouped temporal state for the segment.
   */
  state: TimelineSegmentState;
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
 * Width allocation: Uses SchematicSegment (flexGrow + minWidth) to create
 * proportional widths across the timeline while ensuring legibility.
 */
const TimelineBarAtDock = ({
  state,
  vesselName,
  barStyle = "h-3",
  atDockAbbrev,
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
    status: state.status,
    nowMs,
    startTimeMs: state.startTimeMs,
    endTimeMs: state.endTimeMs,
    predictionEndTimeMs: state.predictionEndTimeMs,
  });

  const progress = state.isArrived ? 1 : timeProgress;

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

  const shouldShowIndicator =
    showIndicator ??
    (state.status === "InProgress" && !state.isArrived && !state.isHeld);

  return (
    <TimelineSegment duration={duration ?? 1} style={style}>
      <TimelineBar flexGrow={1} progress={progress} barStyle={barStyle} />
      {shouldShowIndicator && (
        <TimelineIndicator
          progress={animatedProgress}
          minutesRemaining={minutesRemaining ?? "--"}
        >
          {vesselName && (
            <Text className="text-sm leading-none font-playwrite pt-4">
              {vesselName}
            </Text>
          )}
          {atDockAbbrev && (
            <Text className="text-xs text-muted-foreground font-playwrite-light">
              At Dock {atDockAbbrev}
            </Text>
          )}
        </TimelineIndicator>
      )}
    </TimelineSegment>
  );
};

export default TimelineBarAtDock;
