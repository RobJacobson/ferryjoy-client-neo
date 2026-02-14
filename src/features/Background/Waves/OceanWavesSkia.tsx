// ============================================================================
// Ocean Waves Skia Component
// ============================================================================
// Renders multiple animated wave layers using Skia.
// ============================================================================

import type { SkImage } from "@shopify/react-native-skia";
import { View } from "react-native";
import { createColorGenerator, lerp } from "@/shared/utils";
import AnimatedWaveSkia from "./AnimatedWaveSkia";

const BASE_COLOR = "#28e";
const WAVE_COUNT = 12;
const PERIOD = { min: 100, max: 500 };
const HEIGHT = { min: 40, max: 12 };
const AMPLITUDE = { min: 4, max: 24 };
const ANIMATION_DURATION = { min: 30000, max: 120000 };
const WAVE_DISPLACEMENT = { min: 100, max: 800 };
const LIGHTNESS = { min: 150, max: 500 };

const blueColor = createColorGenerator(BASE_COLOR);

export type OceanWavesSkiaProps = {
  /** Skia Image for the paper texture. */
  paperTexture?: SkImage | null;
};

/**
 * OceanWavesSkia component that renders a layered stack of animated waves using Skia.
 *
 * @param props - Optional paper texture
 */
const OceanWavesSkia = ({ paperTexture }: OceanWavesSkiaProps) => {
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
            <AnimatedWaveSkia
              paperTexture={paperTexture}
              amplitude={lerp(t, 0, 1, AMPLITUDE.min, AMPLITUDE.max)}
              period={lerp(t, 0, 1, PERIOD.min, PERIOD.max)}
              fillColor={blueColor(lerp(t, 0, 1, LIGHTNESS.min, LIGHTNESS.max))}
              height={lerp(t, 0, 1, HEIGHT.min, HEIGHT.max)}
              animationDuration={lerp(
                t,
                0,
                1,
                ANIMATION_DURATION.min,
                ANIMATION_DURATION.max
              )}
              waveDisplacement={lerp(
                t,
                0,
                1,
                WAVE_DISPLACEMENT.min,
                WAVE_DISPLACEMENT.max
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

OceanWavesSkia.displayName = "OceanWavesSkia";

export default OceanWavesSkia;

/**
 * Computes a deterministic phase offset for a wave layer.
 */
const computePhaseOffset = (index: number): number => {
  const t = ((index * 73) % 101) / 101;
  return t * 2 * Math.PI;
};
