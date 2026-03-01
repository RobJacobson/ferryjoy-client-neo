// ============================================================================
// Ocean Wave Specifications
// ============================================================================
// Generates wave render specifications for ocean layers using interpolated
// properties based on layer index. Handles phase offsets and oscillation.
// ============================================================================

import { indexToT, lerpRange } from "./helpers";
import type { OceanLayerConfig, WaveRenderSpec } from "./layerConfig";

/**
 * Generates wave render specifications for ocean layers.
 * Uses interpolated properties based on layer index.
 *
 * @param config - Ocean layer configuration
 * @returns Array of wave render specifications for ocean layers
 */
export const createOceanLayerSpecs = (
  config: OceanLayerConfig
): readonly WaveRenderSpec[] => {
  return Array.from({ length: config.count }, (_, index) => {
    const t = indexToT(index, config.count);
    const parallaxMultiplier = lerpRange(t, config.parallaxRange);

    return {
      key: `${config.prefix}${index}`,
      zIndex: config.baseZIndex + index,
      parallaxMultiplier,
      svgProps: {
        amplitude: lerpRange(t, config.interpolateProps.amplitude),
        period: lerpRange(t, config.interpolateProps.period),
        fillColor: config.colorFn(
          lerpRange(t, config.interpolateProps.lightness)
        ),
        height: lerpRange(t, config.interpolateProps.height),
      },
      oscillationProps: {
        animationDuration: lerpRange(
          t,
          config.interpolateProps.animationDuration
        ),
        maxXShiftPx: config.maxXShiftPx,
        phaseOffset: config.phaseOffsets[index],
      },
    };
  });
};

/**
 * Precomputed phase offsets for ocean waves using prime number-based distribution.
 * Using 73 as a multiplier creates non-repeating phase offsets that prevent waves
 * from appearing synchronized.
 *
 * @param count - Number of ocean wave layers
 * @returns Array of phase offsets in radians
 */
export const createOceanPhaseOffsets = (count: number): readonly number[] =>
  Array.from({ length: count }, (_, index) => {
    const t = ((index * 73) % 101) / 101;
    return t * 2 * Math.PI;
  });
