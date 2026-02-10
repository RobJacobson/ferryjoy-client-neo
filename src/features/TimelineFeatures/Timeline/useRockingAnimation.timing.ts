/**
 * Timing-driven rocking animation for `TimelineIndicator`.
 *
 * This variant uses a linear phase animation and maps it to a sine wave.
 * The rocking is smooth (slow at endpoints, fast through 0) and the period
 * can be updated once per cycle without per-frame recalculation.
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { lerp } from "@/shared/utils/lerp";
import { timelineIndicatorConfig } from "./config";

// ============================================================================
// Constants
// ============================================================================

const TWO_PI = 2 * Math.PI;
const RAMP_IN_MS = 900;
const RAMP_OUT_MS = 700;

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Convert the current speed into an angular velocity (rad/ms) using the same
 * mapping as the frame-driven variant.
 *
 * @param speedKnots - Vessel speed in knots
 * @returns Angular velocity in radians per millisecond
 */
const speedToAngularVelocity = (speedKnots: number): number => {
  "worklet";

  const minOmega = TWO_PI / timelineIndicatorConfig.periodSlowMs;
  const maxOmega = TWO_PI / timelineIndicatorConfig.periodFastMs;

  return lerp(
    speedKnots,
    timelineIndicatorConfig.minSpeedKnots,
    timelineIndicatorConfig.maxSpeedKnots,
    minOmega,
    maxOmega
  );
};

/**
 * Convert an angular velocity (rad/ms) to a cycle duration in milliseconds.
 *
 * @param angularVelocity - Angular velocity in radians per millisecond
 * @returns Duration in milliseconds for one full \(2\pi\) phase cycle
 */
const angularVelocityToDurationMs = (angularVelocity: number): number => {
  "worklet";

  // Guard against pathological values (shouldn't happen with config defaults).
  const safeOmega = angularVelocity <= 0 ? TWO_PI / 20000 : angularVelocity;
  return Math.round(TWO_PI / safeOmega);
};

/**
 * Convert speed in knots into a cycle duration in milliseconds.
 *
 * @param speedKnots - Vessel speed in knots
 * @returns Duration in milliseconds for one full \(2\pi\) phase cycle
 */
const speedToDurationMs = (speedKnots: number): number => {
  const omega = speedToAngularVelocity(speedKnots);
  return angularVelocityToDurationMs(omega);
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Provides an animated rotation style that rocks between \(-max, +max\) degrees.
 * The rocking follows a sine wave: slow at the endpoints, fast through 0.
 *
 * Implementation details:
 * - A `phase` shared value linearly animates from 0 → \(2\pi\) each cycle.
 * - Rotation is derived as `sin(phase) * amplitude`.
 * - The cycle duration is computed once per cycle from `speed`.
 * - When `animate` is disabled, the phase animation is cancelled and the
 *   amplitude eases back to 0 for a gentle settle.
 *
 * @param animate - Whether the rocking animation should be active
 * @param speed - Current vessel speed in knots, used to scale animation period
 * @returns Animated style object containing the rotation transform
 */
const useRockingAnimation = (animate: boolean, speed: number) => {
  const animateSV = useSharedValue(animate);
  const phase = useSharedValue(0);
  const amplitude = useSharedValue(
    animate ? timelineIndicatorConfig.maxRotationDeg : 0
  );

  const speedRef = useRef(speed);
  speedRef.current = speed;

  const [cycleToken, bumpCycleToken] = useReducer((x: number) => x + 1, 0);
  const bumpCycleTokenCb = useCallback(() => {
    bumpCycleToken();
  }, []);

  useEffect(() => {
    animateSV.value = animate;
  }, [animate, animateSV]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: restart per cycle via `cycleToken`; shared values are stable.
  useEffect(() => {
    // `cycleToken` is a deliberate nonce used to restart the next cycle.
    // Referencing it here makes it a real dependency for Biome.
    void cycleToken;

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
      TWO_PI,
      { duration: durationMs, easing: Easing.linear },
      (finished) => {
        "worklet";

        if (!finished) return;
        if (!animateSV.value) return;

        // Schedule the next cycle on the JS thread (once per cycle).
        runOnJS(bumpCycleTokenCb)();
      }
    );

    return () => {
      cancelAnimation(phase);
    };
  }, [animate, bumpCycleTokenCb, cycleToken]);

  return useAnimatedStyle(() => {
    const rotationDeg = Math.sin(phase.value) * amplitude.value;

    return {
      transform: [
        { translateX: -timelineIndicatorConfig.size / 2 },
        { translateY: -timelineIndicatorConfig.size / 2 },
        { rotate: `${rotationDeg}deg` },
      ],
    };
  });
};

export { useRockingAnimation };
