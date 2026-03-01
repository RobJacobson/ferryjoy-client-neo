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
// Layer Configurations
// ----------------------------------------------------------------------------

/** Background grass layer configuration (farthest layers) */
const BACKGROUND_GRASS_CONFIG: GrassLayerConfig = {
  type: "grass",
  prefix: "bg-",
  sourceData: BACKGROUND_LAYERS,
  parallaxRange: PARALLAX_BG_GRASS,
  colorFn: grassColor,
};

/** Foreground grass layer configuration (closest layers) */
const FOREGROUND_GRASS_CONFIG: GrassLayerConfig = {
  type: "grass",
  prefix: "fg-",
  sourceData: FOREGROUND_LAYERS,
  parallaxRange: PARALLAX_FG_GRASS,
  colorFn: grassColor,
  wrapperStyleForIndex: (index: number) =>
    index === FOREGROUND_LAYERS.length - 1 ? { marginBottom: -10 } : undefined,
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
const createGrassLayerSpecs = (
  config: GrassLayerConfig
): readonly WaveRenderSpec[] => {
  return config.sourceData.map((layer, index) => {
    const t = indexToT(index, config.sourceData.length);
    const parallaxMultiplier = lerpRange(t, config.parallaxRange);

    return {
      key: `${config.prefix}${index}`,
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

// ----------------------------------------------------------------------------
// Precomputed Specifications
// ----------------------------------------------------------------------------

/**
 * Precomputed render specifications for background grass layers.
 */
export const BACKGROUND_GRASS_SPECS = createGrassLayerSpecs(
  BACKGROUND_GRASS_CONFIG
);

/**
 * Precomputed render specifications for foreground grass layers.
 */
export const FOREGROUND_GRASS_SPECS = createGrassLayerSpecs(
  FOREGROUND_GRASS_CONFIG
);
