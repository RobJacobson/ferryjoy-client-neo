// ============================================================================
// Layer Specifications Module
// ============================================================================
// Public API for layer specifications system.
// Provides precomputed LAYER_SPECS for rendering.
// ============================================================================

/**
 * Type for a single wave layer's render specification.
 */
export type { WaveRenderSpec } from "./layerConfig";
/**
 * Precomputed render specifications for all wave layers.
 * Combines background grass, ocean waves, and foreground grass into a single
 * ordered array for rendering with proper z-index layering.
 */
export { LAYER_SPECS } from "./layerSpecs";
