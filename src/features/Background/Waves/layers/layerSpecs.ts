// ============================================================================
// Layer Specifications
// ============================================================================
// Combines all precomputed wave layer specifications into a single ordered
// array for rendering with proper z-index layering.
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
