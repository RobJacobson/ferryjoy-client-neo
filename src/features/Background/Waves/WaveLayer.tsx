// ============================================================================
// WaveLayer
// ============================================================================
// Single parallax-enabled wave layer. Combines ParallaxLayer wrapper with
// WaveLayerView content. Receives render spec and computes dimensions internally.
// ============================================================================

import { ParallaxLayer } from "../ParallaxLayer/ParallaxLayer";
import type { PaperTextureSource } from "../types";
import type { WaveRenderSpec } from "./AnimatedWaves";
import { WaveLayerView } from "./WaveLayerView";

// ============================================================================
// Types
// ============================================================================

type WaveLayerProps = {
  /** Complete render specification for this wave layer */
  spec: WaveRenderSpec;
  /** Height of the layer container in pixels */
  containerHeightPx: number;
  /** Paper texture source (null for no texture) */
  paperTextureUrl: PaperTextureSource;
  /** Function to compute parallax distance from multiplier */
  computeParallaxDistance: (multiplier: number) => number;
  /** Function to compute layer container width from multiplier */
  computeLayerContainerWidth: (multiplier: number) => number;
};

// ============================================================================
// WaveLayer
// ============================================================================

/**
 * Renders a single wave layer with parallax translation.
 * Wraps WaveLayerView in ParallaxLayer for scroll-driven movement.
 * Computes parallax distance and layer width from spec's parallaxMultiplier.
 *
 * Coordinate system:
 * - Layer starts at x=0 (left-aligned to viewport)
 * - As scrollProgress goes 0→1, layer translates LEFT
 * - translateX = -scrollProgress × parallaxDistance
 * - Layer must extend right to cover: screenWidth + parallaxDistance
 *
 * @param spec - Wave layer render specification
 * @param containerHeightPx - Container height in pixels
 * @param paperTextureUrl - Paper texture source
 * @param computeParallaxDistance - Function to compute parallax distance
 * @param computeLayerContainerWidth - Function to compute layer width
 * @returns Parallax-translated wave layer
 */
export const WaveLayer = ({
  spec,
  containerHeightPx,
  paperTextureUrl,
  computeParallaxDistance,
  computeLayerContainerWidth,
}: WaveLayerProps) => {
  const layerWidth = computeLayerContainerWidth(spec.parallaxMultiplier);
  const parallaxDistance = computeParallaxDistance(spec.parallaxMultiplier);

  // Merge paperTextureUrl into waveProps
  const mergedWaveProps = {
    ...spec.waveProps,
    paperTextureUrl,
  };

  return (
    <ParallaxLayer
      parallaxDistance={parallaxDistance}
      className="absolute top-0 bottom-0 left-0 overflow-visible"
      style={[{ width: layerWidth, zIndex: spec.zIndex }, spec.wrapperStyle]}
    >
      <WaveLayerView
        waveProps={mergedWaveProps}
        containerWidthPx={layerWidth}
        containerHeightPx={containerHeightPx}
      />
    </ParallaxLayer>
  );
};
