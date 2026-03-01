// ============================================================================
// Grass Layer Specifications
// ============================================================================
// Generates wave render specifications for grass layers using static properties
// read from source data arrays. Handles parallax interpolation across layers.
// ============================================================================

import { PARALLAX_BG_GRASS, PARALLAX_FG_GRASS } from "../../config";
import { BACKGROUND_LAYERS, FOREGROUND_LAYERS, grassColor } from "../config";
import { indexToT, lerpRange } from "./helpers";
import type { GrassLayerConfig, WaveRenderSpec } from "./layerConfig";

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/** Reversed foreground layers for proper z-index ordering */
const FOREGROUND_LAYERS_REVERSED = [...FOREGROUND_LAYERS].reverse();

// ----------------------------------------------------------------------------
// Layer Configurations
// ----------------------------------------------------------------------------

/** Background grass layer configuration (farthest layers) */
export const BACKGROUND_GRASS_CONFIG: GrassLayerConfig = {
  type: "grass",
  prefix: "bg-",
  sourceData: BACKGROUND_LAYERS,
  parallaxRange: PARALLAX_BG_GRASS,
  baseZIndex: 1,
  colorFn: grassColor,
};

/** Foreground grass layer configuration (closest layers) */
export const FOREGROUND_GRASS_CONFIG: GrassLayerConfig = {
  type: "grass",
  prefix: "fg-",
  sourceData: FOREGROUND_LAYERS_REVERSED,
  parallaxRange: PARALLAX_FG_GRASS,
  baseZIndex: 100,
  colorFn: grassColor,
  zIndexForIndex: (index: number) => (index === 0 ? 101 : 100),
  wrapperStyleForIndex: (index: number) =>
    index === 0 ? { marginBottom: -10 } : undefined,
};

// ----------------------------------------------------------------------------
// Functions
// ----------------------------------------------------------------------------

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
