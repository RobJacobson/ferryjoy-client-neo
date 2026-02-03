/**
 * TimelineBar component for rendering individual progress segments in timeline meter.
 * Displays a horizontal progress bar that calculates progress based on numeric values.
 * Uses FlexBox flex-grow for proportional width allocation based on segment duration.
 * Used as a building block within TimelineMeter to create multi-segment progress visualizations.
 */

import { useEffect } from "react";
import type { ViewStyle } from "react-native";
import { LayoutAnimation, View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { shadowStyle } from "./config";
import TimelineIndicator from "./TimelineIndicator";

// ============================================================================
// Types
// ============================================================================

export type TimelineBarStatus = "Pending" | "InProgress" | "Completed";

type TimelineBarProps = {
  /**
   * Progress value between 0 and 1.
   */
  progress: number;
  /**
   * Duration in minutes (used for flex-grow width allocation).
   */
  duration?: number;
  /**
   * Minutes remaining until end of segment.
   */
  minutesRemaining?: number;
  /**
   * Status of the progress bar segment.
   * - "Pending": Progress locked at 0%, no indicator shown
   * - "InProgress": Progress displays normally, indicator shown
   * - "Completed": Progress displays normally, indicator not shown
   */
  status: TimelineBarStatus;
  /**
   * Optional vessel name to display above the progress indicator when in progress.
   */
  vesselName?: string;
  /**
   * Whether to animate the progress indicator when at sea.
   */
  animate?: boolean;
  /**
   * Current speed of the vessel in knots.
   */
  speed?: number;
  /**
   * Size of the circle markers in pixels.
   */
  circleSize?: number;
  /**
   * Height of the progress bar in pixels.
   */
  barHeight?: number;
  /**
   * Distance to arriving terminal in miles.
   */
  arrivingDistance?: number;
  /**
   * Optional terminal abbreviation to display when at dock (e.g., "At Dock SEA").
   */
  atDockAbbrev?: string;
  /**
   * Whether the vessel has arrived at its destination terminal.
   */
  isArrived?: boolean;
  style?: ViewStyle;
};

// ============================================================================
// Component
// ============================================================================

/**
 * Renders a horizontal progress bar that displays progress based on provided values.
 * The bar consists of a background track, a filled progress portion, and optionally
 * a progress indicator when active.
 *
 * Width is determined via FlexBox `flexGrow`, derived from segment's duration.
 *
 * @param progress - Progress value between 0 and 1
 * @param duration - Duration in minutes for width allocation
 * @param minutesRemaining - Minutes remaining until end of segment
 * @param status - Status of the progress bar segment (default "Pending")
 * @param vesselName - Optional vessel name to display above the indicator when in progress
 * @param animate - Whether to animate the progress indicator when at sea
 * @param speed - Current speed of the vessel in knots
 * @param circleSize - Size of the circle markers in pixels (default 20)
 * @param barHeight - Height of the progress bar in pixels (default 12)
 * @param style - Additional inline styles
 * @returns A View containing the progress bar and optional indicator
 */
const TimelineBar = ({
  progress,
  duration,
  minutesRemaining,
  status,
  vesselName,
  animate = false,
  speed = 0,
  circleSize = 20,
  barHeight = 12,
  arrivingDistance,
  atDockAbbrev,
  isArrived = false,
  style,
}: TimelineBarProps) => {
  // Use a shared value to animate progress changes smoothly
  const animatedProgress = useSharedValue(progress);

  // Update the animated value whenever the progress prop changes
  useEffect(() => {
    animatedProgress.value = withSpring(progress, {
      damping: 100,
      stiffness: 2,
      mass: 5,
      overshootClamping: true,
    });
  }, [progress, animatedProgress]);

  // InProgress bars have a higher stacking order to ensure they render on top
  // of adjacent segments (important for overlapping markers).
  // We use 2 and 3 because on Android, elevation also controls shadow size;
  // these values keep the shadow refined while enforcing the correct order.
  const isActive = status === "InProgress";
  const hasUnknownDuration = duration === undefined || duration <= 0;
  const flexGrow = style?.flexGrow ?? (hasUnknownDuration ? 1 : duration);

  // Animate layout changes (like flexGrow/width) when they change
  // biome-ignore lint/correctness/useExhaustiveDependencies: animate the layout changes when flexGrow changes
  useEffect(() => {
    LayoutAnimation.configureNext({
      duration: 5000,
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });
  }, [flexGrow]);

  return (
    <View
      className="relative flex-row items-center"
      style={{
        overflow: "visible",
        flexGrow: flexGrow,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: "20%",
        height: circleSize, // Explicit height to provide vertical centering context
        ...style,
      }}
    >
      <TimelineBarTrack progress={animatedProgress} barHeight={barHeight} />
      {isActive && (
        <TimelineIndicator
          progress={animatedProgress}
          minutesRemaining={minutesRemaining}
          animate={animate}
          speed={speed}
          arrivingDistance={arrivingDistance}
          vesselName={vesselName}
          atDockAbbrev={atDockAbbrev}
          isArrived={isArrived}
        />
      )}
    </View>
  );
};

export default TimelineBar;

// ============================================================================
// Internal Helpers
// ============================================================================

type TimelineBarTrackProps = {
  /**
   * Animated progress value between 0 and 1.
   */
  progress: SharedValue<number>;
  /**
   * Height of the bar in pixels.
   */
  barHeight: number;
};

/**
 * Renders the track + filled segment for the progress bar.
 *
 * @param progress - Animated value between 0 and 1
 * @param barHeight - Height of the bar in pixels
 * @returns Track + fill view
 */
const TimelineBarTrack = ({ progress, barHeight }: TimelineBarTrackProps) => {
  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View
      className="flex-1 rounded-full bg-primary/20"
      style={{ height: barHeight }}
    >
      <Animated.View
        className="rounded-full h-full bg-pink-300"
        style={[animatedStyle, shadowStyle]}
      />
    </View>
  );
};
