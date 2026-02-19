// ============================================================================
// useWaveOscillationCSS Hook
// ============================================================================
// Simplified wave oscillation using Reanimated 4's CSS animations.
// Replaces frame-callback physics with declarative keyframes and negative delays.
// Replaces deprecated useWaveOscillation.ts.
// ============================================================================

import type { ViewStyle } from "react-native";

/** Props for the wave oscillation animation. */
export interface UseWaveOscillationProps {
  /** Animation duration in milliseconds. */
  animationDuration?: number;
  /** Delay before animation starts in milliseconds. */
  animationDelay?: number;
  /** Maximum horizontal displacement in pixels. */
  waveDisplacementPx?: number;
  /** Phase offset for the wave oscillation in radians. */
  phaseOffset?: number;
}

/** Return value from useWaveOscillationCSS. */
export interface UseWaveOscillationResult {
  /** Style to apply to the wrapper Animated.View for horizontal oscillation. */
  animatedOscillationStyle: ViewStyle;
}

/**
 * Drives horizontal sinusoidal oscillation for wave components using CSS animations.
 * Uses negative animationDelay to achieve phase offsets without waiting.
 * Wave oscillates from -displacement to +displacement and back.
 *
 * @param props - Animation parameters (duration, delay, displacement, phase)
 * @returns animatedOscillationStyle
 */
export const useWaveOscillation = ({
  animationDuration,
  animationDelay = 0,
  waveDisplacementPx = 0,
  phaseOffset = 0,
}: UseWaveOscillationProps): UseWaveOscillationResult => {
  const displacementPx = Math.max(0, waveDisplacementPx);
  const shouldAnimate = (animationDuration ?? 0) > 0 && displacementPx > 0;

  if (!shouldAnimate) {
    return { animatedOscillationStyle: {} };
  }

  const durationMs = animationDuration ?? 0;

  // Convert phase offset to negative delay: starts animation immediately at
  // correct phase (no waiting).
  // phaseOffset of 0 = no delay, phaseOffset of π = -50% of duration
  const phaseDelay = -(phaseOffset / (2 * Math.PI)) * durationMs;
  const totalDelay = animationDelay + phaseDelay;

  const animatedOscillationStyle: ViewStyle = {
    animationName: {
      "0%": { transform: [{ translateX: -displacementPx }] },
      "50%": { transform: [{ translateX: displacementPx }] },
      "100%": { transform: [{ translateX: -displacementPx }] },
    },
    animationDuration: durationMs,
    animationDelay: totalDelay,
    animationIterationCount: "infinite",
    animationTimingFunction: "ease-in-out",
  };

  return {
    animatedOscillationStyle,
  };
};
