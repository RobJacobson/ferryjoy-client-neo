// ============================================================================
// Layer Specifications Module
// ============================================================================
// Public API for layer specifications system.
// Provides precomputed LAYER_SPECS for rendering.
// ============================================================================

import {
  BACKGROUND_GRASS_SPECS,
  FOREGROUND_GRASS_SPECS,
} from "./grassLayerSpecs";
import { OCEAN_SPECS } from "./oceanWaveSpecs";

/**
 * Precomputed render specifications for all wave layers.
 * Combines background grass, ocean waves, and foreground grass into a single
 * ordered array for rendering with proper z-index layering.
 */
export const LAYER_SPECS = [
  ...BACKGROUND_GRASS_SPECS,
  ...OCEAN_SPECS,
  ...FOREGROUND_GRASS_SPECS,
];

/**
 * Type for a single wave layer's render specification.
 */
export type { WaveRenderSpec } from "./layerConfig";
