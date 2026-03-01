// ============================================================================
// Layer Specifications Factory
// ============================================================================
// Configuration-driven factory for generating wave layer render specifications.
// Combines background grass, ocean waves, and foreground grass into a single
// ordered array for rendering with proper z-index layering.
// ============================================================================

import {
  PARALLAX_BG_GRASS,
  PARALLAX_FG_GRASS,
  PARALLAX_OCEAN,
} from "../../config";
import {
  BACKGROUND_LAYERS,
  FOREGROUND_LAYERS,
  grassColor,
  OCEAN_WAVES,
  oceanColor,
} from "../config";
import { createGrassLayerSpecs } from "./grassLayerSpecs";
import type { LayerConfig, WaveRenderSpec } from "./layerConfig";
import {
  createOceanLayerSpecs,
  createOceanPhaseOffsets,
} from "./oceanWaveSpecs";

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/** Maximum x-shift for ocean wave oscillation animation */
const MAX_OCEAN_X_SHIFT_PX = OCEAN_WAVES.maxXShiftPx;

/** Reversed foreground layers for proper z-index ordering */
const FOREGROUND_LAYERS_REVERSED = [...FOREGROUND_LAYERS].reverse();

/** Precomputed phase offsets for ocean waves */
const OCEAN_PHASE_OFFSETS = createOceanPhaseOffsets(OCEAN_WAVES.count);

/** Layer configurations for generating all wave specs */
const LAYER_CONFIGS: readonly LayerConfig[] = [
  {
    type: "grass",
    prefix: "bg-",
    sourceData: BACKGROUND_LAYERS,
    parallaxRange: PARALLAX_BG_GRASS,
    baseZIndex: 1,
    colorFn: grassColor,
  },
  {
    type: "ocean",
    prefix: "ocean-",
    count: OCEAN_WAVES.count,
    parallaxRange: PARALLAX_OCEAN,
    baseZIndex: 10,
    interpolateProps: {
      amplitude: OCEAN_WAVES.amplitude,
      period: OCEAN_WAVES.period,
      height: OCEAN_WAVES.height,
      lightness: OCEAN_WAVES.lightness,
      animationDuration: OCEAN_WAVES.animationDuration,
    },
    colorFn: oceanColor,
    phaseOffsets: OCEAN_PHASE_OFFSETS,
    maxXShiftPx: MAX_OCEAN_X_SHIFT_PX,
  },
  {
    type: "grass",
    prefix: "fg-",
    sourceData: FOREGROUND_LAYERS_REVERSED,
    parallaxRange: PARALLAX_FG_GRASS,
    baseZIndex: 100,
    colorFn: grassColor,
    zIndexForIndex: (index) => (index === 0 ? 101 : 100),
    wrapperStyleForIndex: (index) =>
      index === 0 ? { marginBottom: -10 } : undefined,
  },
] as const;

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Generates wave render specifications for a single layer configuration.
 * Routes to the appropriate function based on layer type.
 *
 * @param config - Layer configuration defining how to generate specs
 * @returns Array of wave render specifications
 */
const createLayerSpecs = (config: LayerConfig): readonly WaveRenderSpec[] => {
  if (config.type === "ocean") {
    return createOceanLayerSpecs(config);
  }
  return createGrassLayerSpecs(config);
};

// ----------------------------------------------------------------------------
// Exported Specifications
// ----------------------------------------------------------------------------

/**
 * Precomputed render specifications for all wave layers.
 * Combines background grass, ocean waves, and foreground grass into a single
 * ordered array for rendering with proper z-index layering.
 */
export const LAYER_SPECS: readonly WaveRenderSpec[] =
  LAYER_CONFIGS.flatMap(createLayerSpecs);

// Re-export types for consumers
export type {
  GrassLayerConfig,
  LayerConfig,
  OceanLayerConfig,
  WaveRenderSpec,
} from "./layerConfig";
