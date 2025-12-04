/**
 * Custom hook for creating a pulsing value based on speed
 *
 * This hook creates a smooth pulsing value that:
 * - Shows 0.25 value when speed is 0 (no animation)
 * - Pulses between 0.25 and 1.0 for non-zero speed
 * - Uses a period that ranges from 5s for speed ~0 to 1s for speed >= 20
 * - Runs one animation at a time, checking speed after each animation completes
 */

"use no memo";

const VALUE_MIN = 0.25;
const VALUE_MAX = 1;

const DURATION_MIN = 1000;
const DURATION_MAX = 5000;

import { useEffect, useState } from "react";
import type { SharedValue } from "react-native-reanimated";
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { lerp } from "@/shared/utils";

/**
 * Type definition for the pulse value returned by the hook
 */
export type PulseValue = {
  value: SharedValue<number>;
};

/**
 * Hook for creating a pulsing value based on speed
 *
 * @param speed - Current speed of the vessel in knots
 * @returns Shared value that pulses based on speed
 */
export const usePulseValue = (speed: number): PulseValue => {
  // Create shared value for animation state
  const value = useSharedValue<number>(VALUE_MIN);

  // Use state to track if we have an active animation
  const [hasActiveAnimation, setHasActiveAnimation] = useState(false);

  // Update animation based on speed
  useEffect(() => {
    // Cancel any existing animation
    if (hasActiveAnimation) {
      cancelAnimation(value);
      setHasActiveAnimation(false);
    }

    if (speed > 0) {
      // Start pulsing animation for moving vessels
      const duration = lerp(speed, 0, 20, DURATION_MAX, DURATION_MIN);
      setHasActiveAnimation(true);

      value.value = withRepeat(
        withTiming(VALUE_MAX, {
          duration: duration / 2,
          easing: Easing.inOut(Easing.cubic),
        }),
        -1, // Infinite repeat
        true // Reverse animation
      );
    } else {
      // Set static value for stationary vessels - ONLY when speed changes, not on every render
      if (speed === 0) {
        value.value = VALUE_MIN;
      }
    }
  }, [speed, hasActiveAnimation, value]);

  return { value };
};
