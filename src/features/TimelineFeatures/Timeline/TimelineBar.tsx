/**
 * TimelineBar base component for rendering individual progress segments.
 * Pure presentation component that displays a horizontal progress bar based on provided values.
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
import { cn } from "@/lib/utils";
import {
  colors,
  shadowStyle,
  timelineIndicatorConfig,
  timelineSegmentConfig,
} from "./config";

// ============================================================================
// Types
// ============================================================================

export type TimelineBarStatus = "Pending" | "InProgress" | "Completed";

type TimelineBarProps = {
  /**
   * FlexGrow value for proportional width allocation.
   * Calculated by parent based on segment duration.
   */
  flexGrow: number;
  /**
   * Progress value between 0 and 1 for indicator positioning.
   * Calculated by parent (time-based or distance-based).
   */
  progress: number;
  /**
   * Orientation of the timeline.
   * Defaults to "horizontal".
   */
  orientation?: "horizontal" | "vertical";
  /**
   * NativeWind className for the bar height and other track styling.
   * e.g., "h-3", "h-4", "h-6"
   */
  barStyle?: string;
  /**
   * NativeWind className for the progress fill styling.
   * Defaults to colors.progress.
   */
  progressStyle?: string;
  /**
   * Additional inline styles.
   */
  style?: ViewStyle;
};

/**
 * Renders a progress bar that displays progress based on provided values.
 * The bar consists of a background track and a filled progress portion.
 *
 * Width/Height is determined via FlexBox `flexGrow`. When used as a child of TimelineBarAtDock
 * or TimelineBarAtSea, flexGrow is always 1 (fills parent container). The parent container
 * handles proportional allocation based on segment duration.
 *
 * @param flexGrow - FlexGrow value for allocation (usually 1 when used with at-dock/at-sea containers)
 * @param progress - Progress value between 0 and 1
 * @param orientation - Orientation of the timeline
 * @param barStyle - NativeWind className for track styling (default "h-4")
 * @param progressStyle - NativeWind className for fill styling (default "bg-pink-300")
 * @param style - Additional inline styles
 * @returns A View component containing the progress bar
 */
const TimelineBar = ({
  flexGrow,
  progress,
  orientation = "horizontal",
  barStyle = "h-4",
  progressStyle = colors.progress,
  style,
}: TimelineBarProps) => {
  const isVertical = orientation === "vertical";
  const animatedProgress = useSharedValue(progress);

  // Update the animated value whenever the progress prop changes
  useEffect(() => {
    // If progress is 1 or 0, we jump immediately without spring to avoid initial animation glitch
    if (progress === 1 || progress === 0) {
      animatedProgress.value = progress;
    } else {
      animatedProgress.value = withSpring(progress, {
        damping: 100,
        stiffness: 2,
        mass: 5,
        overshootClamping: true,
      });
    }
  }, [progress, animatedProgress]);

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
      className={cn(
        "relative items-center",
        isVertical ? "flex-column" : "flex-row"
      )}
      style={{
        overflow: "visible",
        flexGrow,
        flexShrink: 1,
        flexBasis: 0,
        [isVertical ? "minHeight" : "minWidth"]: isVertical
          ? "10%"
          : timelineSegmentConfig.minWidth,
        [isVertical ? "width" : "height"]: timelineIndicatorConfig.size, // Match indicator for centering
        zIndex: 2, // Always below markers (TimelineBar < TimelineMarker)
        elevation: 2, // Elevation needed for Android stacking
        ...style,
      }}
    >
      <TimelineBarProgress
        progress={animatedProgress}
        orientation={orientation}
        barStyle={barStyle}
        progressStyle={progressStyle}
      />
    </View>
  );
};

export default TimelineBar;

// ============================================================================
// Internal Helpers
// ============================================================================

type TimelineBarProgressProps = {
  /**
   * Animated progress value between 0 and 1.
   */
  progress: SharedValue<number>;
  /**
   * Orientation of the timeline.
   */
  orientation: "horizontal" | "vertical";
  /**
   * NativeWind className for the bar height and track styling.
   */
  barStyle: string;
  /**
   * NativeWind className for the progress fill styling.
   */
  progressStyle: string;
};

/**
 * Renders the track + filled segment for the progress bar.
 * Centers the 12px track within the indicator-sized container.
 *
 * @param progress - Animated value between 0 and 1
 * @param orientation - Orientation of the timeline
 * @param barStyle - NativeWind className for track styling
 * @param progressStyle - NativeWind className for fill styling
 * @returns Track + fill view
 */
const TimelineBarProgress = ({
  progress,
  orientation,
  barStyle,
  progressStyle,
}: TimelineBarProgressProps) => {
  const isVertical = orientation === "vertical";
  const animatedStyle = useAnimatedStyle(() => ({
    [isVertical ? "height" : "width"]: `${progress.value * 100}%`,
  }));

  return (
    <View
      className={cn("flex-1 rounded-full bg-primary/20", barStyle)}
      style={isVertical ? { width: 12 } : { height: 12 }} // Explicitly set thickness to 12px
    >
      <Animated.View
        className={cn(
          "rounded-full",
          progressStyle,
          isVertical ? "w-full" : "h-full"
        )}
        style={[animatedStyle, shadowStyle]}
      />
    </View>
  );
};
