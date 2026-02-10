// ============================================================================
// Ocean Waves Component
// ============================================================================
// Renders multiple animated wave layers creating a depth effect.
// Uses transform-based animations for optimal 60 FPS performance.
// ============================================================================

import { memo } from "react";
import { View } from "react-native";
import { createColorGenerator } from "@/shared/utils";
import AnimatedWave from "./AnimatedWave";

/** Base color for ocean waves (blue). */
const BASE_COLOR = "#00a6fb";

/** Number of wave layers to render. */
const WAVE_COUNT = 8;

/** Starting period for the first wave layer in SVG units. */
const PERIOD_BASE = 100;

/** Increment in period for each subsequent wave layer. */
const PERIOD_DELTA = 50;

/** Starting height (vertical position) for the first wave layer (0-100). */
const HEIGHT_BASE = 40;

/** Vertical position delta for each subsequent wave layer. */
const HEIGHT_DELTA = -3;

/** Starting amplitude for the first wave layer in SVG units. */
const AMPLITUDE_BASE = 5;

/** Amplitude delta for each subsequent wave layer in SVG units. */
const AMPLITUDE_DELTA = 3;

/** Base animation duration in milliseconds. */
const ANIMATION_DURATION_BASE = 60000;

/** Duration increment for each wave layer in milliseconds. */
const ANIMATION_DURATION_INCREMENT = 0;

/** Maximum horizontal displacement in pixels for wave oscillation. */
const WAVE_DISPLACEMENT_BASE = 100;

/** Displacement increment for each wave layer in pixels. */
const WAVE_DISPLACEMENT_DELTA = 100;

/** Starting lightness value for color generation. */
const LIGHTNESS_BASE = 200;

/** Lightness increment for each wave layer. */
const LIGHTNESS_INCREMENT = 25;

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
  return (
    <>
      {Array.from({ length: WAVE_COUNT }).map((_, index) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: waves never reorder
          key={index}
          className="absolute inset-0"
          style={{ zIndex: index + 10 }}
        >
          <AnimatedWave
            amplitude={AMPLITUDE_BASE + index * AMPLITUDE_DELTA}
            period={PERIOD_BASE + index * PERIOD_DELTA}
            fillColor={blueColor(LIGHTNESS_BASE + index * LIGHTNESS_INCREMENT)}
            height={HEIGHT_BASE + index * HEIGHT_DELTA}
            animationDuration={
              ANIMATION_DURATION_BASE + index * ANIMATION_DURATION_INCREMENT
            }
            waveDisplacement={
              WAVE_DISPLACEMENT_BASE + index * WAVE_DISPLACEMENT_DELTA
            }
            animationDelay={0}
            phaseOffset={computePhaseOffset(index)}
          />
        </View>
      ))}
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
