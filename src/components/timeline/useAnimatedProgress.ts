/**
 * Smoothly animates a scalar toward a new target (indicator vertical position).
 */

import { useEffect } from "react";
import { Easing, useSharedValue, withTiming } from "react-native-reanimated";
import { TIMELINE_INDICATOR_CONFIG } from "./config";

const EASE_IN_OUT_CONFIG = {
  duration: TIMELINE_INDICATOR_CONFIG.motion.progressDurationMs,
  easing: Easing.inOut(Easing.quad),
} as const;

/**
 * Drives a shared value with timing whenever `value` changes.
 *
 * @param value - Next target (e.g. indicator `top` in pixels)
 * @returns Reanimated shared value reflecting the eased transition
 */
export const useAnimatedProgress = (value: number) => {
  const animatedProgress = useSharedValue(value);

  useEffect(() => {
    animatedProgress.value = withTiming(value, EASE_IN_OUT_CONFIG);
  }, [animatedProgress, value]);

  return animatedProgress;
};
