/**
 * Animated position hook for the overlay indicator.
 */

import { useEffect } from "react";
import { Easing, useSharedValue, withTiming } from "react-native-reanimated";

const PROGRESS_ANIMATION_DURATION_MS = 5000;

const EASE_IN_OUT_CONFIG = {
  duration: PROGRESS_ANIMATION_DURATION_MS,
  easing: Easing.inOut(Easing.quad),
} as const;

export const useAnimatedProgress = (value: number, shouldJump = false) => {
  const animatedProgress = useSharedValue(value);

  useEffect(() => {
    if (shouldJump) {
      animatedProgress.value = value;
    } else {
      animatedProgress.value = withTiming(value, EASE_IN_OUT_CONFIG);
    }
  }, [animatedProgress, shouldJump, value]);

  return animatedProgress;
};
