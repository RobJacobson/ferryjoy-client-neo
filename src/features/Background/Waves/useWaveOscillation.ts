// ============================================================================
// useWaveOscillation Hook
// ============================================================================
// Shared animation logic for horizontal wave oscillation.
// Used by AnimatedWave and AnimatedWaveClipped so both stay in sync.
// Uses Reanimated frame callback and transform for 60 FPS performance.
// ============================================================================

import { useEffect } from "react";
import {
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";

/** Base width of the SVG canvas. Overscan is added for displacement. */
const SVG_WIDTH = 2000;

const BASE_FRAME_MS = 1000 / 60;
const MAX_FRAME_DT_MS = 34;
const TWO_PI = 2 * Math.PI;

/**
 * Props used by the wave oscillation animation.
 * Subset of AnimatedWaveProps; shared so the hook can be reused.
 */
export interface UseWaveOscillationProps {
  /**
   * Animation duration in milliseconds.
   * If provided with waveDisplacement, the wave oscillates horizontally.
   */
  animationDuration?: number;

  /**
   * Delay before animation starts in milliseconds.
   */
  animationDelay?: number;

  /**
   * Maximum horizontal displacement in SVG units.
   */
  waveDisplacement?: number;

  /**
   * Phase offset for the wave oscillation in radians.
   */
  phaseOffset?: number;
}

/**
 * Return value from useWaveOscillation.
 */
export interface UseWaveOscillationResult {
  /** Style to apply to the wrapper Animated.View for horizontal oscillation. */
  animatedOscillationStyle: ReturnType<typeof useAnimatedStyle>;

  /** Horizontal overscan in SVG units (for layout and viewBox). */
  overscanX: number;

  /** Total SVG render width (SVG_WIDTH + 2 * overscanX). */
  svgRenderWidth: number;
}

/**
 * Drives horizontal sinusoidal oscillation for wave components.
 * Returns style for the wrapper View and layout values for the SVG.
 *
 * @param props - Animation parameters (duration, delay, displacement, phase)
 * @returns animatedOscillationStyle, overscanX, svgRenderWidth
 */
export function useWaveOscillation({
  animationDuration,
  animationDelay = 0,
  waveDisplacement = 0,
  phaseOffset = 0,
}: UseWaveOscillationProps): UseWaveOscillationResult {
  const overscanX = Math.max(0, waveDisplacement);
  const svgRenderWidth = SVG_WIDTH + overscanX * 2;

  const shouldAnimate = Boolean(animationDuration) && waveDisplacement !== 0;

  const animateSV = useSharedValue(shouldAnimate);
  const delayRemainingMsSV = useSharedValue(Math.max(0, animationDelay));
  const angularVelocityRadPerMsSV = useSharedValue(
    shouldAnimate ? TWO_PI / Math.max(1, animationDuration ?? 1) : 0
  );
  const displacementSV = useSharedValue(waveDisplacement);
  const theta = useSharedValue(phaseOffset);

  const translateX = useDerivedValue(() => {
    return Math.sin(theta.value) * displacementSV.value;
  });

  useEffect(() => {
    animateSV.value = shouldAnimate;
    displacementSV.value = waveDisplacement;
    delayRemainingMsSV.value = Math.max(0, animationDelay);
    angularVelocityRadPerMsSV.value = shouldAnimate
      ? TWO_PI / Math.max(1, animationDuration ?? 1)
      : 0;
    theta.value = phaseOffset;
  }, [
    animateSV,
    animationDelay,
    animationDuration,
    angularVelocityRadPerMsSV,
    delayRemainingMsSV,
    displacementSV,
    phaseOffset,
    theta,
    waveDisplacement,
    shouldAnimate,
  ]);

  const frameCallback = useFrameCallback((frameInfo) => {
    "worklet";

    const rawDtMs = frameInfo.timeSincePreviousFrame;
    const dtMs = rawDtMs ?? BASE_FRAME_MS;
    const cappedDtMs = Math.min(MAX_FRAME_DT_MS, dtMs);

    if (!animateSV.value || rawDtMs == null) {
      return;
    }

    if (delayRemainingMsSV.value > 0) {
      delayRemainingMsSV.value = Math.max(
        0,
        delayRemainingMsSV.value - cappedDtMs
      );
      return;
    }

    theta.value += angularVelocityRadPerMsSV.value * cappedDtMs;
    if (theta.value > TWO_PI) {
      theta.value = theta.value % TWO_PI;
    }
  });

  useEffect(() => {
    frameCallback.setActive(true);
    return () => frameCallback.setActive(false);
  }, [frameCallback]);

  const animatedOscillationStyle = useAnimatedStyle(() => {
    if (!animationDuration || waveDisplacement === 0) {
      return {
        transform: [{ translateX: 0 }],
      };
    }
    return {
      transform: [{ translateX: translateX.value }],
    };
  }, [animationDuration, translateX, waveDisplacement]);

  return {
    animatedOscillationStyle,
    overscanX,
    svgRenderWidth,
  };
}
