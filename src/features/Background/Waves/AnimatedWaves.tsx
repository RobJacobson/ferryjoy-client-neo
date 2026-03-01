// ============================================================================
// Animated Waves (wave stack)
// ============================================================================
// Renders a single stack of Wave layers: background grass, ocean waves, then
// foreground grass. All layers are precomputed; parallax per layer from scroll.
// ============================================================================

import { useWindowDimensions, View } from "react-native";
import { PARALLAX_WAVES_MAX } from "../config";
import type { PaperTextureSource } from "../types";
import { useBackgroundLayout } from "../useBackgroundLayout";
import { LAYER_SPECS } from "./layerSpecs";
import type { WaveLayerLayout } from "./WaveLayer";
import { WaveLayer } from "./WaveLayer";

type AnimatedWavesProps = {
  /**
   * Paper texture source. When null, wave SVGs do not render the texture overlay.
   * Currently unused (always null).
   */
  paperTextureUrl?: PaperTextureSource | null;
};

/**
 * Re-export WaveRenderSpec for consumers of this module.
 */
export type { WaveRenderSpec } from "./layerSpecs";

// ============================================================================
// AnimatedWaves
// ============================================================================

/**
 * Renders the full wave stack (background grass, ocean waves, foreground grass)
 * as a single list of <Wave /> components with precomputed props and parallax.
 * Parallax scroll progress from ParallaxProvider context.
 *
 * Coordinate system:
 * - Layer starts at x=0 (left-aligned to viewport)
 * - As scrollProgress goes 0→1, layer translates LEFT
 * - translateX = -scrollProgress × parallaxDistance
 * - Layer must extend right to cover: screenWidth + parallaxDistance
 *
 * @param paperTextureUrl - Paper texture source (null for no texture, currently unused)
 */
const AnimatedWaves = ({ paperTextureUrl = null }: AnimatedWavesProps) => {
  const { height: containerHeightPx } = useWindowDimensions();
  const { computeParallaxDistance, computeLayerContainerWidth } =
    useBackgroundLayout({
      parallaxMultiplier: PARALLAX_WAVES_MAX,
    });

  // Precompute layout and parallax values for all layers
  const layerConfigs = LAYER_SPECS.map((spec) => ({
    spec: {
      ...spec,
      svgProps: {
        ...spec.svgProps,
        paperTextureUrl,
      },
    },
    layout: {
      containerWidthPx: computeLayerContainerWidth(spec.parallaxMultiplier),
      containerHeightPx,
    } satisfies WaveLayerLayout,
    parallaxDistance: computeParallaxDistance(spec.parallaxMultiplier),
  }));

  return (
    <View className="absolute top-0 right-0 bottom-0 left-0 overflow-visible">
      {layerConfigs.map(({ spec, layout, parallaxDistance }) => (
        <WaveLayer
          key={spec.key}
          spec={spec}
          layout={layout}
          parallaxDistance={parallaxDistance}
        />
      ))}
    </View>
  );
};

export default AnimatedWaves;
