/**
 * TimelineIndicator component for rendering a progress indicator overlay
 * that displays minutes remaining in a circular badge.
 * Pure presentation component - all business logic about what to display is handled by parent.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Text } from "@/components/ui";
import { cn } from "@/lib/utils";
import { colors, shadowStyle, timelineIndicatorConfig } from "./config";
import { useRockingAnimation } from "./utils/useRockingAnimation";

// ============================================================================
// Types
// ============================================================================

type TimelineIndicatorProps = {
  /**
   * Animated progress value (0-1) for positioning within the parent bar.
   */
  progress: SharedValue<number>;
  /**
   * Orientation of the timeline.
   * Defaults to "horizontal".
   */
  orientation?: "horizontal" | "vertical";
  /**
   * Whether to animate the indicator with a rocking motion.
   * Only used for at-sea segments.
   */
  animate?: boolean;
  /**
   * Current speed of the vessel in knots.
   * Used to scale animation frequency.
   */
  speed?: number;
  /**
   * Minutes remaining to display in the indicator badge.
   * Can be a number or string like "--" for unknown.
   */
  minutesRemaining?: number | string;
  /**
   * NativeWind className for the indicator container.
   * Defaults to cn(colors.background, colors.border).
   */
  indicatorStyle?: string;
  /**
   * Position of the labels relative to the indicator badge.
   * Defaults to "bottom" for horizontal, "left" for vertical orientation.
   * Can be overridden explicitly.
   */
  labelPosition?: "bottom" | "left" | "right";
  /**
   * Labels to display above (horizontal) or beside (vertical) the indicator.
   * Provided by parent component (business logic).
   */
  children?: ReactNode;
  /**
   * Height of the container for proper vertical centering.
   * Defaults to timelineIndicatorConfig.size to match TimelineBar height.
   */
  containerHeight?: number;
};

// ============================================================================
// Component
// ============================================================================

/**
 * Renders a progress indicator positioned based on progress value within the parent bar.
 * The indicator is absolutely positioned and displays the minutes remaining.
 * Labels are passed as children to be displayed above/beside the indicator.
 * Uses elevation for stacking as a sibling of TimelineBar and TimelineMarker.
 *
 * @param progress - Progress value (0-1) for horizontal/vertical positioning
 * @param animate - Whether to animate with rocking motion (default false)
 * @param speed - Current speed for animation frequency scaling (default 0)
 * @param minutesRemaining - Minutes remaining to display (default "--")
 * @param indicatorStyle - NativeWind className for indicator styling
 * @param labelPosition - Position of labels: "bottom" (horizontal), "left" (vertical), or "right"
 * @param children - Labels to display above/beside the indicator
 * @returns A View component containing the indicator and optional labels
 */
const TimelineIndicator = ({
  progress,
  orientation = "horizontal",
  animate = false,
  speed = 0,
  minutesRemaining = "--",
  indicatorStyle = cn(colors.background, colors.border),
  labelPosition,
  children,
}: TimelineIndicatorProps) => {
  const rockingStyle = useRockingAnimation(animate, speed);

  // Derive labelPosition from orientation if not explicitly provided
  const effectiveLabelPosition =
    labelPosition ?? (orientation === "vertical" ? "left" : "bottom");

  const animatedPositionStyle = useAnimatedStyle(() => {
    // Clamp progress to 0-1 to prevent indicator from jumping outside bounds
    // during fast transitions or hold window resets.
    const clampedProgress = Math.min(1, Math.max(0, progress.value));
    return orientation === "horizontal"
      ? {
          left: `${clampedProgress * 100}%`,
        }
      : {
          top: `${clampedProgress * 100}%`,
        };
  }, [progress, orientation]);

  return (
    <Animated.View
      className="absolute items-center justify-center"
      pointerEvents="none"
      collapsable={false}
      style={[
        {
          top: "50%",
          left: "50%",
          width: timelineIndicatorConfig.size,
          height: timelineIndicatorConfig.size,
          zIndex: timelineIndicatorConfig.zIndex,
          elevation: timelineIndicatorConfig.zIndex,
          overflow: "visible",
        },
        rockingStyle,
        animatedPositionStyle,
      ]}
    >
      {/* Labels above/beside indicator - positioned based on labelPosition */}
      {children && (
        <View
          pointerEvents="none"
          collapsable={false}
          className="absolute items-center"
          style={{
            ...(effectiveLabelPosition === "bottom" && {
              bottom: timelineIndicatorConfig.size + 2,
              width: 250, // Sufficient width to prevent wrapping
            }),
            ...(effectiveLabelPosition === "left" && {
              right: timelineIndicatorConfig.size + 2,
              alignItems: "flex-end",
            }),
            ...(effectiveLabelPosition === "right" && {
              left: timelineIndicatorConfig.size + 2,
              alignItems: "flex-start",
            }),
          }}
        >
          {children}
        </View>
      )}
      {/* Indicator circle */}
      <View
        className={cn(
          "items-center justify-center rounded-full border-[2px]",
          indicatorStyle
        )}
        style={{
          width: timelineIndicatorConfig.size,
          height: timelineIndicatorConfig.size,
          ...shadowStyle,
        }}
      >
        <Text
          className={cn(
            colors.text,
            "font-playpen-600",
            typeof minutesRemaining === "number" && minutesRemaining >= 100
              ? "mt-1 text-base"
              : "mt-[-1px] text-lg"
          )}
        >
          {minutesRemaining}
        </Text>
      </View>
    </Animated.View>
  );
};

export default TimelineIndicator;
