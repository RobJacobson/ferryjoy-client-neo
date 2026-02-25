/**
 * Frame-driven rocking animation for `TimelineIndicator`.
 *
 * This is the original implementation extracted from `TimelineIndicator.tsx`.
 * It advances a sine-wave phase every frame and maps it to a rotation angle.
 */

import { useEffect } from "react";
import {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import { timelineIndicatorConfig } from "./config";

// ============================================================================
// Constants (animation tuning; not in timelineIndicatorConfig)
// ============================================================================

/**
 * Decay factor for returning to 0deg (per frame at a 60fps baseline).
 * Implemented as time-based decay to keep behavior stable across frame drops.
 */
const DECAY_FACTOR = 0.25;

/** Minimum rotation threshold before snapping to 0. */
const SNAP_THRESHOLD = 0.01;

const BASE_FRAME_MS = 1000 / 60;
const TWO_PI = 2 * Math.PI;

const MIN_OMEGA_RAD_PER_MS = TWO_PI / timelineIndicatorConfig.periodSlowMs;
const MAX_OMEGA_RAD_PER_MS = TWO_PI / timelineIndicatorConfig.periodFastMs;

// ============================================================================
// Hook
// ============================================================================

/**
 * Converts the current speed into an angular velocity (rad/ms).
 *
 * @param speedKnots - Vessel speed in knots
 * @returns Angular velocity in radians per millisecond
 */
const speedToAngularVelocity = (speedKnots: number): number => {
  "worklet";

  const speedRange =
    timelineIndicatorConfig.maxSpeedKnots -
    timelineIndicatorConfig.minSpeedKnots;
  if (speedRange <= 0) {
    return MIN_OMEGA_RAD_PER_MS;
  }

  const t = (speedKnots - timelineIndicatorConfig.minSpeedKnots) / speedRange;
  const clampedT = Math.min(1, Math.max(0, t));

  return (
    MIN_OMEGA_RAD_PER_MS +
    (MAX_OMEGA_RAD_PER_MS - MIN_OMEGA_RAD_PER_MS) * clampedT
  );
};

/**
 * Provides an animated rotation style that rocks between \(-max, +max\) degrees.
 * The rocking approximates a sine wave: slow at the endpoints, fast through 0.
 *
 * Note: This implementation runs per-frame math via `useFrameCallback` and
 * recomputes angular velocity each frame based on the current `speed` prop.
 *
 * @param animate - Whether the rocking animation should be active
 * @param speed - Current vessel speed in knots, used to scale animation period
 * @returns Animated style object containing the rotation transform
 */
const useRockingAnimation = (animate: boolean, speed: number) => {
  const animateSV = useSharedValue(animate);
  const speedSV = useSharedValue(speed);

  // theta represents the phase of our sine wave animation (accumulated time * frequency)
  const theta = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    animateSV.value = animate;
  }, [animate, animateSV]);

  useEffect(() => {
    speedSV.value = speed;
  }, [speed, speedSV]);

  // Use a frame callback to drive the animation manually
  const frameCallback = useFrameCallback((frameInfo) => {
    const rawDtMs = frameInfo.timeSincePreviousFrame;
    const dtMs = rawDtMs ?? BASE_FRAME_MS;

    if (!animateSV.value || rawDtMs == null) {
      // Smoothly return to 0 when not animating
      if (rotation.value !== 0) {
        // Time-based decay so it behaves consistently even when frames drop.
        const decayMultiplier = DECAY_FACTOR ** (dtMs / BASE_FRAME_MS);
        rotation.value = rotation.value * decayMultiplier;
        if (Math.abs(rotation.value) < SNAP_THRESHOLD) rotation.value = 0;
      }
      return;
    }

    // Map speed to angular velocity (rad/ms)
    const angularVelocity = speedToAngularVelocity(speedSV.value);

    // Advance theta based on elapsed time and current speed
    theta.value += angularVelocity * dtMs;
    if (theta.value > TWO_PI) {
      // Keep phase bounded to avoid long-run float growth.
      theta.value = theta.value % TWO_PI;
    }

    // Map theta to rotation using sine
    rotation.value =
      Math.sin(theta.value) * timelineIndicatorConfig.maxRotationDeg;
  });

  // Start/stop the frame callback based on the animate prop
  useEffect(() => {
    // We keep the callback active even when not animating to allow for the decay to 0
    frameCallback.setActive(true);
    return () => frameCallback.setActive(false);
  }, [frameCallback]);

  return useAnimatedStyle(() => ({
    transform: [
      { translateX: -timelineIndicatorConfig.size / 2 },
      { translateY: -timelineIndicatorConfig.size / 2 },
      { rotate: `${rotation.value}deg` },
    ],
  }));
};

export { useRockingAnimation };
