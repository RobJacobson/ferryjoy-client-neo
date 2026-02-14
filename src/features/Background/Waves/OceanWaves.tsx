// ============================================================================
// Ocean Waves Component
// ============================================================================
// Renders multiple animated wave layers creating a depth effect.
// Uses transform-based animations for optimal 60 FPS performance.
// Wave properties use { min, max } ranges and lerp by index (first wave = min,
// last wave = max) so changing count preserves the approximate look.
// ============================================================================

import { View } from "react-native";
import { createColorGenerator, lerp } from "@/shared/utils";
import type { PaperTextureSource } from "../types";
import AnimatedWave from "./AnimatedWave";
import { OCEAN_WAVES } from "./config";

const blueColor = createColorGenerator(OCEAN_WAVES.baseColor);

export type OceanWavesProps = {
  /** Paper texture source. When null, wave SVGs do not render texture. */
  paperTextureUrl: PaperTextureSource;
};

/**
 * OceanWaves component that renders a layered stack of animated waves.
 *
 * Creates a depth effect by stacking multiple wave layers with varying
 * amplitudes, periods, and colors. Each wave oscillates left and right
 * with sinusoidal easing and staggered timing for a natural, organic appearance.
 *
 * Animation uses GPU-accelerated transforms for optimal performance (60 FPS).
 *
 * @param props - paperTextureUrl passed to each AnimatedWave
 */
const OceanWaves = ({ paperTextureUrl }: OceanWavesProps) => {
  const { count } = OCEAN_WAVES;
  const tForIndex = (index: number) => (count > 1 ? index / (count - 1) : 0);

  return (
    <>
      {Array.from({ length: count }).map((_, index) => {
        const t = tForIndex(index);
        return (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: waves never reorder
            key={index}
            className="absolute inset-0"
            style={{ zIndex: index + 10 }}
          >
            <AnimatedWave
              paperTextureUrl={paperTextureUrl}
              amplitude={lerp(
                t,
                0,
                1,
                OCEAN_WAVES.amplitude.min,
                OCEAN_WAVES.amplitude.max,
              )}
              period={lerp(
                t,
                0,
                1,
                OCEAN_WAVES.period.min,
                OCEAN_WAVES.period.max,
              )}
              fillColor={blueColor(
                lerp(
                  t,
                  0,
                  1,
                  OCEAN_WAVES.lightness.min,
                  OCEAN_WAVES.lightness.max,
                ),
              )}
              height={lerp(
                t,
                0,
                1,
                OCEAN_WAVES.height.min,
                OCEAN_WAVES.height.max,
              )}
              animationDuration={lerp(
                t,
                0,
                1,
                OCEAN_WAVES.animationDuration.min,
                OCEAN_WAVES.animationDuration.max,
              )}
              waveDisplacement={lerp(
                t,
                0,
                1,
                OCEAN_WAVES.waveDisplacement.min,
                OCEAN_WAVES.waveDisplacement.max,
              )}
              animationDelay={0}
              phaseOffset={computePhaseOffset(index)}
            />
          </View>
        );
      })}
    </>
  );
};

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
