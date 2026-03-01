// ============================================================================
// Grass Layer Specifications
// ============================================================================
// Generates wave render specifications for grass layers using static properties
// read from source data arrays. Handles parallax interpolation across layers.
// ============================================================================

import { lerp } from "@/shared/utils";
import type { GrassLayerConfig, WaveRenderSpec } from "./layerConfig";

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
 * Generates wave render specifications for grass layers.
 * Uses static properties read from source data arrays.
 *
 * @param config - Grass layer configuration
 * @returns Array of wave render specifications for grass layers
 */
export const createGrassLayerSpecs = (
  config: GrassLayerConfig
): readonly WaveRenderSpec[] => {
  return config.sourceData.map((layer, index) => {
    const t = indexToT(index, config.sourceData.length);
    const parallaxMultiplier = lerp(
      t,
      config.parallaxRange.min,
      config.parallaxRange.max
    );

    return {
      key: `${config.prefix}${index}`,
      zIndex: config.zIndexForIndex?.(index) ?? config.baseZIndex + index,
      parallaxMultiplier,
      wrapperStyle: config.wrapperStyleForIndex?.(index),
      svgProps: {
        amplitude: layer.amplitude,
        period: layer.period,
        fillColor: layer.fillColor ?? config.colorFn(layer.lightness ?? 0),
        height: layer.height,
        xOffsetPx: layer.xOffsetPx,
      },
    };
  });
};
