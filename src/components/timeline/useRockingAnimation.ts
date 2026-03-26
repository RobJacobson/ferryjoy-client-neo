/**
 * Gentle rocking rotation for the live indicator when the vessel is under way.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { TIMELINE_INDICATOR_CONFIG } from "./config";

/**
 * Maps vessel speed to one full rocking cycle duration (faster = shorter).
 *
 * @param speedKnots - Current speed in knots
 * @returns Cycle length in milliseconds, clamped to the configured range
 */
const speedToDurationMs = (speedKnots: number): number => {
  const range =
    TIMELINE_INDICATOR_CONFIG.motion.rocking.maxSpeedKnots -
    TIMELINE_INDICATOR_CONFIG.motion.rocking.minSpeedKnots;

  if (range <= 0) {
    return TIMELINE_INDICATOR_CONFIG.motion.rocking.slowPeriodMs;
  }

  const t = Math.min(
    1,
    Math.max(
      0,
      (speedKnots - TIMELINE_INDICATOR_CONFIG.motion.rocking.minSpeedKnots) /
        range
    )
  );
  return Math.round(
    TIMELINE_INDICATOR_CONFIG.motion.rocking.slowPeriodMs -
      (TIMELINE_INDICATOR_CONFIG.motion.rocking.slowPeriodMs -
        TIMELINE_INDICATOR_CONFIG.motion.rocking.fastPeriodMs) *
        t
  );
};

/**
 * Worklet: maps a 0–1 phase to a signed rotation within ±`maxDeg`.
 *
 * @param phase - Animation phase in one cycle (0–1)
 * @param maxDeg - Peak rotation magnitude in degrees
 * @returns Rotation in degrees for the current phase
 */
const phaseToRotation = (phase: number, maxDeg: number): number => {
  "worklet";

  if (phase <= 0.5) {
    const t = phase / 0.5;
    const eased = Easing.inOut(Easing.sin)(t);
    return -maxDeg + 2 * maxDeg * eased;
  }

  const t = (phase - 0.5) / 0.5;
  const eased = Easing.inOut(Easing.sin)(t);
  return maxDeg - 2 * maxDeg * eased;
};

/**
 * Returns an animated style that rocks the indicator when `animate` is true.
 *
 * @param animate - When false, ramps amplitude to zero and stops the cycle
 * @param speedKnots - Drives cycle speed when animating
 * @returns Reanimated style with `rotate` derived from phase and amplitude
 */
export const useRockingAnimation = (animate: boolean, speedKnots: number) => {
  const phase = useSharedValue(0);
  const amplitude = useSharedValue(
    animate ? TIMELINE_INDICATOR_CONFIG.motion.rocking.maxRotationDeg : 0
  );
  const speedRef = useRef(speedKnots);
  speedRef.current = speedKnots;

  const [cycle, setCycle] = useState(0);
  const startNextCycle = useCallback(() => setCycle((value) => value + 1), []);

  useEffect(() => {
    void cycle;

    if (!animate) {
      amplitude.value = withTiming(0, {
        duration: TIMELINE_INDICATOR_CONFIG.motion.rocking.rampOutMs,
        easing: Easing.out(Easing.cubic),
      });
      cancelAnimation(phase);
      phase.value = 0;
      return;
    }

    amplitude.value = withTiming(
      TIMELINE_INDICATOR_CONFIG.motion.rocking.maxRotationDeg,
      {
        duration: TIMELINE_INDICATOR_CONFIG.motion.rocking.rampInMs,
        easing: Easing.out(Easing.cubic),
      }
    );

    cancelAnimation(phase);
    phase.value = 0;
    phase.value = withTiming(
      1,
      {
        duration: speedToDurationMs(speedRef.current),
        easing: Easing.linear,
      },
      (finished) => {
        "worklet";
        if (!finished) {
          return;
        }
        scheduleOnRN(startNextCycle);
      }
    );

    return () => cancelAnimation(phase);
  }, [amplitude, animate, cycle, phase, startNextCycle]);

  return useAnimatedStyle(() => ({
    transform: [
      { rotate: `${phaseToRotation(phase.value, amplitude.value)}deg` },
    ],
  }));
};
