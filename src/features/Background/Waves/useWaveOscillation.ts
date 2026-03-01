// ============================================================================
// useWaveOscillationCSS Hook
// ============================================================================
// Simplified wave oscillation using Reanimated 4's CSS animations.
// Replaces frame-callback physics with declarative keyframes and negative delays.
// Replaces deprecated useWaveOscillation.ts.
// ============================================================================

import type { ViewStyle } from "react-native";

// Additional margin beyond max shift to ensure SVG seams never appear in viewport.
const SEAM_MARGIN_PX = 16;

/**
 * Props for wave oscillation animation.
 * When undefined or all properties falsy, no animation is applied.
 */
export type WaveOscillationProps = {
  /** Animation duration in milliseconds. */
  animationDuration?: number;
  /** Delay before animation starts in milliseconds. */
  animationDelay?: number;
  /** Maximum horizontal oscillation distance in pixels. */
  maxXShiftPx?: number;
  /** Phase offset for the wave oscillation in radians. */
  phaseOffset?: number;
};

/**
 * Props for the useWaveOscillation hook.
 */
interface UseWaveOscillationProps {
  /** Wave oscillation configuration. */
  oscillationProps?: WaveOscillationProps;
}

/**
 * Return value from useWaveOscillationCSS.
 */
interface UseWaveOscillationResult {
  /** Style to apply to the wrapper Animated.View for horizontal oscillation. */
  animatedOscillationStyle: ViewStyle;
  /** Overscan pixels (shift + margin to prevent SVG seams). */
  overscanPx: number;
}

/**
 * Drives horizontal sinusoidal oscillation for wave components using CSS animations.
 * Uses negative animationDelay to achieve phase offsets without waiting.
 * Wave oscillates from -displacement to +displacement and back.
 *
 * When oscillationProps is undefined or all properties falsy, returns empty
 * style object and minimal overscan (no animation).
 *
 * @param oscillationProps - Wave oscillation configuration (optional)
 * @returns Object containing animatedOscillationStyle and overscan pixels
 */
export const useWaveOscillation = ({
  oscillationProps,
}: UseWaveOscillationProps): UseWaveOscillationResult => {
  if (!oscillationProps) {
    return {
      animatedOscillationStyle: {},
      overscanPx: SEAM_MARGIN_PX,
    };
  }

  const {
    animationDuration,
    animationDelay = 0,
    maxXShiftPx = 0,
    phaseOffset = 0,
  } = oscillationProps;

  const xShiftPx = Math.max(0, maxXShiftPx);
  const shouldAnimate = (animationDuration ?? 0) > 0 && xShiftPx > 0;

  if (!shouldAnimate) {
    return {
      animatedOscillationStyle: {},
      overscanPx: SEAM_MARGIN_PX,
    };
  }

  const durationMs = animationDuration ?? 0;

  // Convert phase offset to negative delay: starts animation immediately at
  // correct phase (no waiting).
  // phaseOffset of 0 = no delay, phaseOffset of π = -50% of duration
  const phaseDelay = -(phaseOffset / (2 * Math.PI)) * durationMs;
  const totalDelay = animationDelay + phaseDelay;

  const overscanPx = xShiftPx + SEAM_MARGIN_PX;

  const animatedOscillationStyle: ViewStyle = {
    animationName: {
      "0%": { transform: [{ translateX: -xShiftPx }] },
      "50%": { transform: [{ translateX: xShiftPx }] },
      "100%": { transform: [{ translateX: -xShiftPx }] },
    },
    animationDuration: durationMs,
    animationDelay: totalDelay,
    animationIterationCount: "infinite",
    animationTimingFunction: "ease-in-out",
  };

  return {
    animatedOscillationStyle,
    overscanPx,
  };
};
