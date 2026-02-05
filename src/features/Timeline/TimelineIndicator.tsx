/**
 * TimelineIndicator component for rendering a progress indicator overlay
 * that displays minutes remaining in a circular badge.
 * Pure presentation component - all business logic about what to display is handled by parent.
 */

import type { ReactNode } from "react";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import { Text } from "@/components/ui";
import { lerp } from "@/shared/utils/lerp";
import { shadowStyle } from "./config";

// ============================================================================
// Constants
// ============================================================================

const INDICATOR_SIZE = 32;

/** Z-index value for stacking above markers and other timeline elements */
const INDICATOR_Z_INDEX_VALUE = 20;

/** Maximum rotation angle in degrees */
const MAX_ROTATION_DEG = 3;

/** Speed range for animation scaling (knots) */
const MIN_SPEED_KNOTS = 0;
const MAX_SPEED_KNOTS = 20;

/** Animation period range in milliseconds */
const PERIOD_SLOW_MS = 20000;
const PERIOD_FAST_MS = 7500;

/** Decay factor for returning to 0deg (per frame) */
const DECAY_FACTOR = 0.25;

/** Minimum rotation threshold before snapping to 0 */
const SNAP_THRESHOLD = 0.01;

// ============================================================================
// Types
// ============================================================================

type TimelineIndicatorProps = {
  /**
   * Animated progress value (0-1) for horizontal positioning within the parent bar.
   */
  progress: SharedValue<number>;
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
   * e.g., "bg-pink-50 border-pink-500"
   */
  indicatorStyle?: string;
  /**
   * NativeWind className for the minutes text.
   * e.g., "text-pink-500 font-bold"
   */
  textStyle?: string;
  /**
   * Labels to display above the indicator.
   * Provided by parent component (business logic).
   */
  children?: ReactNode;
  /**
   * Height of the container for proper vertical centering.
   * Defaults to 32px to match TimelineBar height.
   */
  containerHeight?: number;
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Custom hook to manage the rocking animation phase and rotation.
 *
 * @param animate - Whether the animation should be active
 * @param speed - Current vessel speed for frequency scaling
 * @returns An animated style object for the rotation transform
 */
const useRockingAnimation = (animate: boolean, speed: number) => {
  // Memoize the random delay so it stays consistent for the lifetime of the component
  // const randomDelay = useMemo(() => Math.random() * 10000, []);

  // theta represents the phase of our sine wave animation (accumulated time * frequency)
  const theta = useSharedValue(0);
  const rotation = useSharedValue(0);

  // Use a frame callback to drive the animation manually
  const frameCallback = useFrameCallback((frameInfo) => {
    if (!animate || !frameInfo.timeSincePreviousFrame) {
      // Smoothly return to 0 when not animating
      if (rotation.value !== 0) {
        rotation.value = rotation.value * DECAY_FACTOR;
        if (Math.abs(rotation.value) < SNAP_THRESHOLD) rotation.value = 0;
      }
      return;
    }

    // Map speed to angular velocity (rad/ms)
    const minFreq = (2 * Math.PI) / PERIOD_SLOW_MS;
    const maxFreq = (2 * Math.PI) / PERIOD_FAST_MS;
    const angularVelocity = lerp(
      speed,
      MIN_SPEED_KNOTS,
      MAX_SPEED_KNOTS,
      minFreq,
      maxFreq
    );

    // Advance theta based on elapsed time and current speed
    theta.value += angularVelocity * frameInfo.timeSincePreviousFrame;

    // Map theta to rotation using sine
    rotation.value = Math.sin(theta.value) * MAX_ROTATION_DEG;
  });

  // Start/stop the frame callback based on the animate prop
  useEffect(() => {
    // We keep the callback active even when not animating to allow for the decay to 0
    frameCallback.setActive(true);
    return () => frameCallback.setActive(false);
  }, [frameCallback]);

  return useAnimatedStyle(() => ({
    transform: [
      { translateX: -INDICATOR_SIZE / 2 },
      { translateY: -INDICATOR_SIZE / 2 },
      { rotate: `${rotation.value}deg` },
    ],
  }));
};

// ============================================================================
// Component
// ============================================================================

/**
 * Renders a progress indicator positioned based on progress value within the parent bar.
 * The indicator is absolutely positioned and displays the minutes remaining.
 * Labels are passed as children to be displayed above the indicator.
 * Uses elevation for stacking as a sibling of TimelineBar and TimelineMarker.
 *
 * @param progress - Progress value (0-1) for horizontal positioning
 * @param animate - Whether to animate with rocking motion (default false)
 * @param speed - Current speed for animation frequency scaling (default 0)
 * @param minutesRemaining - Minutes remaining to display (default "--")
 * @param indicatorStyle - NativeWind className for indicator styling
 * @param textStyle - NativeWind className for text styling
 * @param children - Labels to display above the indicator
 * @returns A View component containing the indicator and optional labels
 */
const TimelineIndicator = ({
  progress,
  animate = false,
  speed = 0,
  minutesRemaining = "--",
  indicatorStyle = "bg-pink-50 border-pink-500",
  textStyle = "text-pink-500 font-bold",
  children,
}: TimelineIndicatorProps) => {
  const rockingStyle = useRockingAnimation(animate, speed);

  const animatedPositionStyle = useAnimatedStyle(() => {
    // Clamp progress to 0-1 to prevent indicator from jumping outside bounds
    // during fast transitions or hold window resets.
    const clampedProgress = Math.min(1, Math.max(0, progress.value));
    return {
      left: `${clampedProgress * 100}%`,
    };
  }, [progress]);

  return (
    <Animated.View
      className="absolute items-center justify-center"
      pointerEvents="none"
      collapsable={false}
      style={[
        {
          top: "50%",
          width: INDICATOR_SIZE,
          height: INDICATOR_SIZE,
          zIndex: INDICATOR_Z_INDEX_VALUE,
          elevation: INDICATOR_Z_INDEX_VALUE,
          overflow: "visible",
        },
        rockingStyle,
        animatedPositionStyle,
      ]}
    >
      {/* Labels above indicator - centered horizontally via items-center on parent */}
      {children && (
        <View
          pointerEvents="none"
          collapsable={false}
          className="absolute items-center"
          style={{
            bottom: INDICATOR_SIZE + 2,
            width: 250, // Sufficient width to prevent wrapping
          }}
        >
          {children}
        </View>
      )}
      {/* Indicator circle */}
      <View
        className={`rounded-full items-center justify-center border-2 ${indicatorStyle}`}
        style={{
          width: INDICATOR_SIZE,
          height: INDICATOR_SIZE,
          ...shadowStyle,
        }}
      >
        <Text
          className={textStyle}
          style={
            typeof minutesRemaining === "number" && minutesRemaining >= 100
              ? { fontSize: 12 }
              : undefined
          }
        >
          {minutesRemaining}
        </Text>
      </View>
    </Animated.View>
  );
};

export default TimelineIndicator;
