// ============================================================================
// useWaveOscillationCSS Hook
// ============================================================================
// Simplified wave oscillation using Reanimated 4's CSS animations.
// Replaces frame-callback physics with declarative keyframes and negative delays.
// Replaces deprecated useWaveOscillation.ts.
// ============================================================================

import type { ViewStyle } from "react-native";
import { SVG_WIDTH } from "./config";

/** Props for the wave oscillation animation. */
export interface UseWaveOscillationProps {
  /** Animation duration in milliseconds. */
  animationDuration?: number;
  /** Delay before animation starts in milliseconds. */
  animationDelay?: number;
  /** Maximum horizontal displacement in SVG units. */
  waveDisplacement?: number;
  /** Phase offset for the wave oscillation in radians. */
  phaseOffset?: number;
}

/** Return value from useWaveOscillationCSS. */
export interface UseWaveOscillationResult {
  /** Style to apply to the wrapper Animated.View for horizontal oscillation. */
  animatedOscillationStyle: ViewStyle;
  /** Horizontal overscan in SVG units (for layout and viewBox). */
  overscanX: number;
  /** Total SVG render width (SVG_WIDTH + 2 * overscanX). */
  svgRenderWidth: number;
}

/**
 * Drives horizontal sinusoidal oscillation for wave components using CSS animations.
 * Uses negative animationDelay to achieve phase offsets without waiting.
 * Wave oscillates from center (translateX: 0) to +displacement and back.
 *
 * @param props - Animation parameters (duration, delay, displacement, phase)
 * @returns animatedOscillationStyle, overscanX, svgRenderWidth
 */
export const useWaveOscillationCSS = ({
  animationDuration,
  animationDelay = 0,
  waveDisplacement = 0,
  phaseOffset = 0,
}: UseWaveOscillationProps): UseWaveOscillationResult => {
  const overscanX = Math.max(0, waveDisplacement);
  const svgRenderWidth = SVG_WIDTH + overscanX * 2;

  const shouldAnimate = Boolean(animationDuration) && waveDisplacement !== 0;

  if (!shouldAnimate) {
    return {
      animatedOscillationStyle: {
        transform: [{ translateX: 0 }],
      },
      overscanX,
      svgRenderWidth,
    };
  }

  // Convert phase offset to negative delay: starts animation immediately at correct phase
  // phaseOffset of 0 = no delay, phaseOffset of π = -50% of duration
  // biome-ignore lint/style/noNonNullAssertion: Already checked via shouldAnimate
  const phaseDelay = -(phaseOffset / (2 * Math.PI)) * animationDuration!;
  const totalDelay = animationDelay + phaseDelay;

  const animatedOscillationStyle: ViewStyle = {
    animationName: {
      "0%": { transform: [{ translateX: 0 }] },
      "50%": { transform: [{ translateX: waveDisplacement }] },
      "100%": { transform: [{ translateX: 0 }] },
    },
    animationDuration,
    animationDelay: totalDelay,
    animationIterationCount: "infinite",
    animationTimingFunction: "ease-in-out",
  };

  return {
    animatedOscillationStyle,
    overscanX,
    svgRenderWidth,
  };
};
