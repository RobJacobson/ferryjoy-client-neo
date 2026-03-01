// ============================================================================
// Ocean Wave Specifications
// ============================================================================
// Generates wave render specifications for ocean layers using interpolated
// properties based on layer index. Handles phase offsets and oscillation.
// ============================================================================

import { lerp } from "@/shared/utils";
import type { OceanLayerConfig, WaveRenderSpec } from "./layerConfig";

/**
 * Normalizes an index to a 0-1 range based on count of items.
 * Handles edge case where count is 1 by returning 0.
 *
 * @param index - Current index in the sequence
 * @param count - Total number of items
 * @returns Normalized value between 0 and 1
 */
const indexToT = (index: number, count: number): number =>
  count > 1 ? index / (count - 1) : 0;

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
    const parallaxMultiplier = lerp(
      t,
      config.parallaxRange.min,
      config.parallaxRange.max
    );

    return {
      key: `${config.prefix}${index}`,
      zIndex: config.baseZIndex + index,
      parallaxMultiplier,
      svgProps: {
        amplitude: lerp(
          t,
          config.interpolateProps.amplitude.min,
          config.interpolateProps.amplitude.max
        ),
        period: lerp(
          t,
          config.interpolateProps.period.min,
          config.interpolateProps.period.max
        ),
        fillColor: config.colorFn(
          lerp(
            t,
            config.interpolateProps.lightness.min,
            config.interpolateProps.lightness.max
          )
        ),
        height: lerp(
          t,
          config.interpolateProps.height.min,
          config.interpolateProps.height.max
        ),
      },
      oscillationProps: {
        animationDuration: lerp(
          t,
          config.interpolateProps.animationDuration.min,
          config.interpolateProps.animationDuration.max
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
