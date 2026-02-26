/**
 * Timing-driven rocking animation for TimelineIndicator.
 *
 * Phase animates 0→1 linearly; rotation maps -3° → 3° → -3° with sine easing
 * on each half, giving slow motion at the edges and fast through center.
 * Cycle duration scales with vessel speed; speed changes apply at cycle end.
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
import { timelineIndicatorConfig } from "../config";

// ============================================================================
// Constants
// ============================================================================

const RAMP_IN_MS = 900;
const RAMP_OUT_MS = 700;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Maps vessel speed (knots) to cycle duration (ms).
 *
 * @param speedKnots - Vessel speed in knots
 * @returns Duration in milliseconds for one full rock cycle
 */
const speedToDurationMs = (speedKnots: number): number => {
  const { minSpeedKnots, maxSpeedKnots, periodSlowMs, periodFastMs } =
    timelineIndicatorConfig;
  const range = maxSpeedKnots - minSpeedKnots;
  if (range <= 0) return periodSlowMs;

  const t = Math.min(1, Math.max(0, (speedKnots - minSpeedKnots) / range));
  return Math.round(periodSlowMs - (periodSlowMs - periodFastMs) * t);
};

/** Phase 0→0.5→1 maps to rotation -max→max→-max with sine easing on each half. */
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

// ============================================================================
// Hook
// ============================================================================

/**
 * Provides animated rotation style for TimelineIndicator.
 * Phase 0→1 linear; rotation uses sine easing on each half.
 *
 * @param animate - Whether rocking is active
 * @param speed - Vessel speed in knots (scales period)
 * @returns Animated style for the indicator
 */
export function useRockingAnimation(animate: boolean, speed: number) {
  const phase = useSharedValue(0);
  const amplitude = useSharedValue(
    animate ? timelineIndicatorConfig.maxRotationDeg : 0
  );
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const [cycle, setCycle] = useState(0);
  const startNextCycle = useCallback(() => setCycle((c) => c + 1), []);

  useEffect(() => {
    void cycle; // Triggers restart when completion callback bumps cycle.
    if (!animate) {
      amplitude.value = withTiming(0, {
        duration: RAMP_OUT_MS,
        easing: Easing.out(Easing.cubic),
      });
      cancelAnimation(phase);
      phase.value = 0;
      return;
    }

    amplitude.value = withTiming(timelineIndicatorConfig.maxRotationDeg, {
      duration: RAMP_IN_MS,
      easing: Easing.out(Easing.cubic),
    });

    const durationMs = speedToDurationMs(speedRef.current);
    cancelAnimation(phase);
    phase.value = 0;
    phase.value = withTiming(
      1,
      { duration: durationMs, easing: Easing.linear },
      (finished) => {
        "worklet";
        if (!finished) return;
        scheduleOnRN(startNextCycle);
      }
    );

    return () => cancelAnimation(phase);
  }, [animate, startNextCycle, cycle, amplitude, phase]);

  const pivot = -timelineIndicatorConfig.size / 2;

  return useAnimatedStyle(() => {
    const rotationDeg = phaseToRotation(phase.value, amplitude.value);
    return {
      transform: [
        { translateX: pivot },
        { translateY: pivot },
        { rotate: `${rotationDeg}deg` },
      ],
    };
  });
}
