// ============================================================================
// Grass Layer Specifications
// ============================================================================
// Generates wave render specifications for grass layers using static properties
// read from source data arrays. Handles parallax interpolation across layers.
// ============================================================================

import { indexToT, lerpRange } from "./helpers";
import type { GrassLayerConfig, WaveRenderSpec } from "./layerConfig";

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
    const parallaxMultiplier = lerpRange(t, config.parallaxRange);

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
