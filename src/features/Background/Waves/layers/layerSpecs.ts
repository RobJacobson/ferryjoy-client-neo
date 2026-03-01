// ============================================================================
// Layer Specifications
// ============================================================================
// Combines background grass, ocean waves, and foreground grass into a single
// ordered array of render specifications for proper z-index layering.
// ============================================================================

import {
  BACKGROUND_GRASS_CONFIG,
  createGrassLayerSpecs,
  FOREGROUND_GRASS_CONFIG,
} from "./grassLayerSpecs";
import type { WaveRenderSpec } from "./layerConfig";
import { createOceanLayerSpecs, OCEAN_CONFIG } from "./oceanWaveSpecs";

/**
 * Precomputed render specifications for all wave layers.
 * Combines background grass, ocean waves, and foreground grass into a single
 * ordered array for rendering with proper z-index layering.
 */
export const LAYER_SPECS: readonly WaveRenderSpec[] = [
  ...createGrassLayerSpecs(BACKGROUND_GRASS_CONFIG),
  ...createOceanLayerSpecs(OCEAN_CONFIG),
  ...createGrassLayerSpecs(FOREGROUND_GRASS_CONFIG),
];
