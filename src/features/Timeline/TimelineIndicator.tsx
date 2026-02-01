/**
 * TimelineIndicator component for rendering a progress indicator overlay
 * that displays minutes remaining in a circular badge.
 */

import type { ReactElement } from "react";
import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, {
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
const INDICATOR_Z_INDEX = 50;

/** Maximum rotation angle in degrees */
const MAX_ROTATION_DEG = 3;

/** Speed range for animation scaling (knots) */
const MIN_SPEED_KNOTS = 0;
const MAX_SPEED_KNOTS = 30;

/** Animation period range in milliseconds */
const PERIOD_SLOW_MS = 15000;
const PERIOD_FAST_MS = 5000;

/** Decay factor for returning to 0deg (per frame) */
const DECAY_FACTOR = 0.9;

/** Minimum rotation threshold before snapping to 0 */
const SNAP_THRESHOLD = 0.01;

// ============================================================================
// Types
// ============================================================================

type TimelineIndicatorProps = {
  /**
   * Progress value (0-1) for horizontal positioning within the parent bar.
   */
  progress: number;
  /**
   * Minutes remaining to display in the indicator.
   */
  minutesRemaining?: number;
  /**
   * Optional label content to display above the indicator.
   * Must be a ReactElement (e.g., a Text component).
   */
  labelAbove?: ReactElement;
  /**
   * Whether to animate the indicator with a rocking motion.
   */
  animate?: boolean;
  /**
   * Current speed of the vessel in knots.
   */
  speed?: number;
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
  const randomDelay = useMemo(() => Math.random() * 10000, []);

  // theta represents the phase of our sine wave animation (accumulated time * frequency)
  const theta = useSharedValue(randomDelay);
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
 * Optionally displays a label above the indicator when labelAbove is provided.
 *
 * @param progress - Progress value (0-1) for horizontal positioning
 * @param minutesRemaining - Minutes remaining to display
 * @param labelAbove - Optional label text to display above the indicator
 * @param animate - Whether to animate the indicator with a rocking motion
 * @param speed - Current speed of the vessel in knots
 * @returns A View component containing the indicator and optional label
 */
const TimelineIndicator = ({
  progress,
  minutesRemaining,
  labelAbove,
  animate = false,
  speed = 0,
}: TimelineIndicatorProps) => {
  const displayMinutes =
    minutesRemaining === undefined ? "--" : String(minutesRemaining);

  const rockingStyle = useRockingAnimation(animate, speed);

  return (
    <Animated.View
      className="absolute items-center justify-center"
      pointerEvents="none"
      collapsable={false}
      style={[
        {
          top: "50%",
          left: `${progress * 100}%`,
          width: INDICATOR_SIZE,
          height: INDICATOR_SIZE,
          zIndex: INDICATOR_Z_INDEX,
          elevation: INDICATOR_Z_INDEX,
          overflow: "visible",
        },
        rockingStyle,
      ]}
    >
      {/* Label above indicator - centered horizontally via items-center on parent */}
      {labelAbove && (
        <View
          pointerEvents="none"
          collapsable={false}
          className="absolute items-center"
          style={{
            bottom: INDICATOR_SIZE + 2,
            width: 200, // Sufficient width to prevent wrapping
          }}
        >
          {labelAbove}
        </View>
      )}
      {/* Indicator circle */}
      <View
        className="rounded-full items-center justify-center border-2 bg-pink-50 border-pink-500"
        style={{
          width: INDICATOR_SIZE,
          height: INDICATOR_SIZE,
          ...shadowStyle,
        }}
      >
        <Text
          className="font-bold text-pink-500"
          style={
            minutesRemaining === undefined || minutesRemaining < 100
              ? undefined
              : { fontSize: 12 }
          }
        >
          {displayMinutes}
        </Text>
      </View>
    </Animated.View>
  );
};

export default TimelineIndicator;
