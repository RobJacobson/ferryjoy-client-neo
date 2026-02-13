// ============================================================================
// Ocean Waves Component
// ============================================================================
// Renders multiple animated wave layers (clip-path variant) creating a depth effect.
// Uses transform-based animations for optimal 60 FPS performance.
// Wave properties use { min, max } ranges and lerp by index (first wave = min,
// last wave = max) so changing WAVE_COUNT preserves the approximate look.
// ============================================================================

import { memo } from "react";
import { View } from "react-native";
import { createColorGenerator, lerp } from "@/shared/utils";
import AnimatedWaveClipped from "./AnimatedWaveClipped";

/** Base color for ocean waves (blue). */
const BASE_COLOR = "#28e";

/** Number of wave layers to render. */
const WAVE_COUNT = 12;

/** Period in SVG units: lerped from min (first wave) to max (last wave). */
const PERIOD = { min: 100, max: 500 };

/** Height (vertical position 0–100): lerped from min (first) to max (last). */
const HEIGHT = { min: 40, max: 12 };

/** Amplitude in SVG units: lerped from min (first wave) to max (last wave). */
const AMPLITUDE = { min: 4, max: 24 };

/** Animation duration in ms: lerped from min to max (same value = constant). */
const ANIMATION_DURATION = { min: 30000, max: 120000 };

/** Max horizontal displacement in px: lerped from min to max. */
const WAVE_DISPLACEMENT = { min: 100, max: 800 };

/** Lightness for color generation: lerped from min (first) to max (last). */
const LIGHTNESS = { min: 150, max: 500 };

/**
 * Color generator for blue shades, using blue-500 as base color.
 */
const blueColor = createColorGenerator(BASE_COLOR);

/**
 * OceanWaves component that renders a layered stack of animated waves.
 *
 * Creates a depth effect by stacking multiple wave layers with varying
 * amplitudes, periods, and colors. Each wave oscillates left and right
 * with sinusoidal easing and staggered timing for a natural, organic appearance.
 *
 * Animation uses GPU-accelerated transforms for optimal performance (60 FPS).
 */
const OceanWaves = memo(() => {
  const tForIndex = (index: number) =>
    WAVE_COUNT > 1 ? index / (WAVE_COUNT - 1) : 0;

  return (
    <>
      {Array.from({ length: WAVE_COUNT }).map((_, index) => {
        const t = tForIndex(index);
        return (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: waves never reorder
            key={index}
            className="absolute inset-0"
            style={{ zIndex: index + 10 }}
          >
            <AnimatedWaveClipped
              amplitude={lerp(t, 0, 1, AMPLITUDE.min, AMPLITUDE.max)}
              period={lerp(t, 0, 1, PERIOD.min, PERIOD.max)}
              fillColor={blueColor(lerp(t, 0, 1, LIGHTNESS.min, LIGHTNESS.max))}
              height={lerp(t, 0, 1, HEIGHT.min, HEIGHT.max)}
              animationDuration={lerp(
                t,
                0,
                1,
                ANIMATION_DURATION.min,
                ANIMATION_DURATION.max,
              )}
              waveDisplacement={lerp(
                t,
                0,
                1,
                WAVE_DISPLACEMENT.min,
                WAVE_DISPLACEMENT.max,
              )}
              animationDelay={0}
              phaseOffset={computePhaseOffset(index)}
            />
          </View>
        );
      })}
    </>
  );
});

export default OceanWaves;

/**
 * Computes a deterministic phase offset for a wave layer.
 * This keeps layers out of phase (different start position + direction) without
 * relying on animation delays.
 *
 * @param index - Wave layer index (0-based)
 * @returns Phase offset in radians
 */
const computePhaseOffset = (index: number): number => {
  // Simple integer hash -> [0, 1)
  const t = ((index * 73) % 101) / 101;
  return t * 2 * Math.PI;
};
