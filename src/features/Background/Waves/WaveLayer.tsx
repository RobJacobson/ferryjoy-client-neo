// ============================================================================
// WaveLayer
// ============================================================================
// Single parallax-enabled wave layer. Combines ParallaxLayer wrapper with
// WaveLayerView content. Receives render spec with all properties (including
// paperTextureUrl in waveProps) and precomputed layout dimensions.
// ============================================================================

import { ParallaxLayer } from "../ParallaxLayer/ParallaxLayer";
import type { WaveRenderSpec } from "./AnimatedWaves";
import { WaveLayerView } from "./WaveLayerView";

// ============================================================================
// Types
// ============================================================================

type WaveLayerProps = {
  /** Complete render specification for this wave layer */
  spec: WaveRenderSpec;
  /** Layout dimensions for the wave layer container */
  layout: WaveLayerLayout;
  /** Parallax distance in pixels for this layer */
  parallaxDistance: number;
};

/**
 * Layout configuration for a wave layer container.
 * Groups dimension-related properties needed for rendering.
 */
export type WaveLayerLayout = {
  /** Width of the layer container in pixels */
  containerWidthPx: number;
  /** Height of the layer container in pixels */
  containerHeightPx: number;
};

// ============================================================================
// WaveLayer
// ============================================================================

/**
 * Renders a single wave layer with parallax translation.
 * Wraps WaveLayerView in ParallaxLayer for scroll-driven movement.
 * Uses precomputed layout dimensions and parallax distance.
 *
 * Coordinate system:
 * - Layer starts at x=0 (left-aligned to viewport)
 * - As scrollProgress goes 0→1, layer translates LEFT
 * - translateX = -scrollProgress × parallaxDistance
 * - Layer must extend right to cover: screenWidth + parallaxDistance
 *
 * @param spec - Wave layer render specification (includes paperTextureUrl in svgProps)
 * @param layout - Layout dimensions for the wave layer container
 * @param parallaxDistance - Parallax distance in pixels
 * @returns Parallax-translated wave layer
 */
export const WaveLayer = ({
  spec,
  layout,
  parallaxDistance,
}: WaveLayerProps) => {
  const { containerWidthPx, containerHeightPx } = layout;

  return (
    <ParallaxLayer
      parallaxDistance={parallaxDistance}
      style={[
        {
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: layout.containerWidthPx,
          overflow: "visible",
        },
        spec.wrapperStyle,
      ]}
    >
      <WaveLayerView
        svgProps={{
          ...spec.svgProps,
          renderWidthPx: containerWidthPx,
          renderHeightPx: containerHeightPx,
        }}
        oscillationProps={spec.oscillationProps}
      />
    </ParallaxLayer>
  );
};
