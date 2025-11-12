/**
 * Custom hook for vessel pulsing animation based on speed
 *
 * This hook creates a smooth pulsing animation for vessels that:
 * - Shows 25% opacity when speed is 0 (no animation)
 * - Pulses between 25% and 75% opacity for non-zero speed
 * - Uses a period that ranges from 5s for speed ~0 to 1s for speed >= 20
 * - Runs one animation at a time, checking speed after each animation completes
 */

"use no memo";

const OPACITY_MIN = 0.25;
const OPACITY_MAX = 1;

const DURATION_MIN = 1000;
const DURATION_MAX = 5000;

import { useEffect, useState } from "react";
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { lerp } from "@/shared/utils";

/**
 * Hook for creating vessel pulsing animation based on speed
 *
 * @param speed - Current speed of the vessel in knots
 * @returns Animated style object with opacity property
 */
export const useVesselPulseAnimation = (speed: number) => {
  // Create shared value for animation state
  const opacity = useSharedValue<number>(OPACITY_MIN);

  // Use state to track if we have an active animation
  const [hasActiveAnimation, setHasActiveAnimation] = useState(false);

  // Update animation based on speed
  useEffect(() => {
    // Cancel any existing animation
    if (hasActiveAnimation) {
      cancelAnimation(opacity);
      setHasActiveAnimation(false);
    }

    if (speed > 0) {
      // Start pulsing animation for moving vessels
      const duration = lerp(speed, 0, 20, DURATION_MAX, DURATION_MIN);
      setHasActiveAnimation(true);

      opacity.value = withRepeat(
        withTiming(OPACITY_MAX, {
          duration: duration / 2,
          easing: Easing.inOut(Easing.cubic),
        }),
        -1, // Infinite repeat
        true // Reverse animation
      );
    } else {
      // Set static opacity for stationary vessels - ONLY when speed changes, not on every render
      if (speed === 0) {
        opacity.value = OPACITY_MIN;
      }
    }
  }, [speed, hasActiveAnimation, opacity]);

  // Create animated style
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  return animatedStyle;
};
