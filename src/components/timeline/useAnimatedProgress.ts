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

export const useAnimatedProgress = (value: number) => {
  const animatedProgress = useSharedValue(value);

  useEffect(() => {
    animatedProgress.value = withTiming(value, EASE_IN_OUT_CONFIG);
  }, [animatedProgress, value]);

  return animatedProgress;
};
