// ============================================================================
// Animated Waves (wave stack)
// ============================================================================
// Renders a single stack of Wave layers: background grass, ocean waves, then
// foreground grass. All layers are precomputed; parallax per layer from scroll.
// ============================================================================

import type { StyleProp, ViewStyle } from "react-native";
import { useWindowDimensions, View } from "react-native";
import { lerp } from "@/shared/utils";
import {
  PARALLAX_BG_GRASS,
  PARALLAX_FG_GRASS,
  PARALLAX_OCEAN,
  PARALLAX_WAVES_MAX,
} from "../config";
import type { PaperTextureSource } from "../types";
import { useBackgroundLayout } from "../useBackgroundLayout";
import {
  BACKGROUND_LAYERS,
  FOREGROUND_LAYERS,
  grassColor,
  OCEAN_WAVES,
  oceanColor,
} from "./config";
import { WaveLayer } from "./WaveLayer";
import type { WaveLayerContentProps, WaveLayerLayout } from "./WaveLayerView";

type AnimatedWavesProps = {
  /**
   * Paper texture source. When null, wave SVGs do not render the texture overlay.
   * Currently unused (always null).
   */
  paperTextureUrl?: PaperTextureSource | null;
};

/**
 * Precomputed phase offsets for ocean waves using prime number-based distribution.
 * Using 73 as a multiplier creates non-repeating phase offsets that prevent waves
 * from appearing synchronized.
 */
const OCEAN_PHASE_OFFSETS = Array.from(
  { length: OCEAN_WAVES.count },
  (_, index) => {
    const t = ((index * 73) % 101) / 101;
    return t * 2 * Math.PI;
  }
);

/**
 * Reversed foreground layers for proper z-index ordering.
 * The first layer needs higher z-index to appear on top.
 */
const FOREGROUND_LAYERS_REVERSED = [...FOREGROUND_LAYERS].reverse();

/**
 * Precomputed render specification for a single wave layer.
 * Contains all data needed to render a wave with parallax and oscillation.
 */
export type WaveRenderSpec = {
  /** Unique React key for this wave layer */
  key: string;
  /** Z-index for layer ordering (lower = farther, higher = closer) */
  zIndex: number;
  /** Parallax multiplier (0-100) for scroll-driven horizontal movement */
  parallaxMultiplier: number;
  /** Optional additional styles for the layer wrapper view */
  wrapperStyle?: StyleProp<ViewStyle>;
  /** Props for the WaveLayerView component */
  waveProps: WaveLayerContentProps;
};

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
      waveProps: {
        ...spec.waveProps,
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

/**
 * Normalizes an index to a 0-1 range based on the count of items.
 * Handles edge case where count is 1 by returning 0.
 *
 * @param index - Current index in the sequence
 * @param count - Total number of items
 * @returns Normalized value between 0 and 1
 */
const indexToT = (index: number, count: number): number =>
  count > 1 ? index / (count - 1) : 0;

/**
 * Overscan budget for grass layers, in pixels.
 *
 * Important: this must be stable and NOT derived from per-layer `xOffsetPx`.
 * Otherwise, changing one layer's xOffset would change the render rail width
 * for every grass layer and make unrelated layers appear to shift.
 */
const GRASS_MAX_X_SHIFT_PX = 120;

const MAX_OCEAN_X_SHIFT_PX = OCEAN_WAVES.maxXShiftPx;

const BACKGROUND_SPECS: readonly WaveRenderSpec[] = BACKGROUND_LAYERS.map(
  (layer, index) => {
    const t = indexToT(index, BACKGROUND_LAYERS.length);
    const parallaxMultiplier = lerp(
      t,
      PARALLAX_BG_GRASS.min,
      PARALLAX_BG_GRASS.max
    );

    return {
      key: `bg-${index}-${layer.height}-${layer.period}-${layer.amplitude}`,
      zIndex: index + 1,
      parallaxMultiplier,
      waveProps: {
        amplitude: layer.amplitude,
        period: layer.period,
        fillColor: layer.fillColor ?? grassColor(layer.lightness ?? 0),
        height: layer.height,
        xOffsetPx: layer.xOffsetPx,
        maxXShiftPx: GRASS_MAX_X_SHIFT_PX,
      },
    };
  }
);

const OCEAN_SPECS: readonly WaveRenderSpec[] = Array.from(
  { length: OCEAN_WAVES.count },
  (_, index) => {
    const t = indexToT(index, OCEAN_WAVES.count);
    const zIndex = 10 + index;
    const parallaxMultiplier = lerp(t, PARALLAX_OCEAN.min, PARALLAX_OCEAN.max);

    return {
      key: `ocean-${zIndex}`,
      zIndex,
      parallaxMultiplier,
      waveProps: {
        amplitude: lerp(
          t,
          OCEAN_WAVES.amplitude.min,
          OCEAN_WAVES.amplitude.max
        ),
        period: lerp(t, OCEAN_WAVES.period.min, OCEAN_WAVES.period.max),
        fillColor: oceanColor(
          lerp(t, OCEAN_WAVES.lightness.min, OCEAN_WAVES.lightness.max)
        ),
        height: lerp(t, OCEAN_WAVES.height.min, OCEAN_WAVES.height.max),
        animationDuration: lerp(
          t,
          OCEAN_WAVES.animationDuration.min,
          OCEAN_WAVES.animationDuration.max
        ),
        maxXShiftPx: MAX_OCEAN_X_SHIFT_PX,
        phaseOffset: OCEAN_PHASE_OFFSETS[index],
      },
    };
  }
);

const FOREGROUND_SPECS: readonly WaveRenderSpec[] =
  FOREGROUND_LAYERS_REVERSED.map((layer, index) => {
    const t = indexToT(index, FOREGROUND_LAYERS.length);
    const parallaxMultiplier = lerp(
      t,
      PARALLAX_FG_GRASS.min,
      PARALLAX_FG_GRASS.max
    );
    const zIndex = index === 0 ? 101 : 100;
    const wrapperStyle = index === 0 ? { marginBottom: -10 } : undefined;

    return {
      key: `fg-${index}-${layer.height}-${layer.period}-${layer.amplitude}`,
      zIndex,
      parallaxMultiplier,
      wrapperStyle,
      waveProps: {
        amplitude: layer.amplitude,
        period: layer.period,
        fillColor: grassColor(layer.lightness),
        height: layer.height,
        xOffsetPx: layer.xOffsetPx,
        maxXShiftPx: GRASS_MAX_X_SHIFT_PX,
      },
    };
  });

const LAYER_SPECS: readonly WaveRenderSpec[] = [
  ...BACKGROUND_SPECS,
  ...OCEAN_SPECS,
  ...FOREGROUND_SPECS,
];

export default AnimatedWaves;
