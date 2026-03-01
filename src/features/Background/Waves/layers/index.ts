// ============================================================================
// Layer Specifications Module
// ============================================================================
// Clean exports for the layer specifications system. Provides LAYER_SPECS for
// rendering and types for configuration.
// ============================================================================

export { createGrassLayerSpecs } from "./grassLayerSpecs";
export { indexToT, lerpRange } from "./helpers";
export type {
  GrassLayerConfig,
  LayerConfig,
  OceanLayerConfig,
  WaveRenderSpec,
} from "./layerSpecs";
export { LAYER_SPECS } from "./layerSpecs";
export {
  createOceanLayerSpecs,
  createOceanPhaseOffsets,
} from "./oceanWaveSpecs";
