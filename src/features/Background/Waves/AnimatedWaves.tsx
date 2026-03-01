// ============================================================================
// Animated Waves (wave stack)
// ============================================================================
// Renders a single stack of Wave layers: background grass, ocean waves, then
// foreground grass. All layers are precomputed; parallax per layer from scroll.
// ============================================================================

import { useWindowDimensions, View } from "react-native";
import { useIsLandscape } from "@/shared/hooks/useIsLandscape";
import { getMaxParallaxPx } from "../config";
import {
  computeLayerContainerWidth,
  computeParallaxDistance,
} from "../ParallaxLayer/parallaxWidth";
import type { PaperTextureSource } from "../types";
import { LAYER_SPECS } from "./layers";
import type { WaveLayerLayout } from "./WaveLayer";
import { WaveLayer } from "./WaveLayer";

type AnimatedWavesProps = {
  /**
   * Paper texture source. When null, wave SVGs do not render the texture overlay.
   * Currently unused (always null).
   */
  paperTextureUrl?: PaperTextureSource | null;
  scrollableRange: number;
  itemStride: number;
};

/**
 * Re-export WaveRenderSpec for consumers of this module.
 */
export type { WaveRenderSpec } from "./layers/layerConfig";

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
 * @param scrollableRange - Total pixels the carousel can scroll
 * @param itemStride - One scroll step in pixels (itemSize + spacing)
 */
const AnimatedWaves = ({
  paperTextureUrl = null,
  scrollableRange,
  itemStride,
}: AnimatedWavesProps) => {
  const { height: containerHeightPx, width: screenWidth } =
    useWindowDimensions();
  const isLandscape = useIsLandscape();
  const maxParallaxPx = getMaxParallaxPx(isLandscape);

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
      containerWidthPx: computeLayerContainerWidth(
        screenWidth,
        scrollableRange,
        spec.parallaxMultiplier,
        itemStride,
        maxParallaxPx
      ),
      containerHeightPx,
    } satisfies WaveLayerLayout,
    parallaxDistance: computeParallaxDistance(
      scrollableRange,
      spec.parallaxMultiplier,
      itemStride,
      maxParallaxPx
    ),
  }));

  return (
    <View className="absolute inset-0 overflow-visible">
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
