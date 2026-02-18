// ============================================================================
// useWaveOscillationCSS Hook
// ============================================================================
// Simplified wave oscillation using Reanimated 4's CSS animations.
// Replaces frame-callback physics with declarative keyframes and negative delays.
// ~40 lines vs 161 lines in legacy implementation.
// ============================================================================

import { SVG_WIDTH } from "./config";
import type {
  UseWaveOscillationProps,
  UseWaveOscillationResult,
} from "./useWaveOscillation";

/**
 * Drives horizontal sinusoidal oscillation for wave components using CSS animations.
 * Uses negative animationDelay to achieve phase offsets without waiting.
 * Wave oscillates from center (translateX: 0) to +displacement and back.
 *
 * @param animationDuration - Animation duration in milliseconds
 * @param waveDisplacement - Maximum horizontal displacement in SVG units
 * @param phaseOffset - Phase offset for the wave oscillation in radians
 * @returns animatedOscillationStyle, overscanX, svgRenderWidth
 */
export const useWaveOscillationCSS = ({
  animationDuration,
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
  const delay = -(phaseOffset / (2 * Math.PI)) * animationDuration!;

  const animatedOscillationStyle = {
    animationName: {
      "0%": { transform: [{ translateX: 0 }] },
      "50%": { transform: [{ translateX: waveDisplacement }] },
      "100%": { transform: [{ translateX: 0 }] },
    },
    animationDuration,
    animationDelay: delay,
    animationIterationCount: "infinite" as const,
    animationTimingFunction: "ease-in-out" as const,
  };

  return {
    animatedOscillationStyle,
    overscanX,
    svgRenderWidth,
  };
};
