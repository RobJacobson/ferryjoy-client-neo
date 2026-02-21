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
import { ParallaxLayer } from "../ParallaxLayer";
import type { BackgroundParallaxProps, PaperTextureSource } from "../types";
import { useBackgroundLayout } from "../useBackgroundLayout";
import {
  BACKGROUND_LAYERS,
  FOREGROUND_LAYERS,
  grassColor,
  OCEAN_WAVES,
  oceanColor,
} from "./config";
import { WaveLayerView, type WaveLayerViewProps } from "./WaveLayerView";

type AnimatedWavesProps = BackgroundParallaxProps & {
  /**
   * Paper texture source. When null, wave SVGs do not render the texture overlay.
   */
  paperTextureUrl: PaperTextureSource;
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

type WaveLayerBaseProps = Omit<
  WaveLayerViewProps,
  "containerWidthPx" | "containerHeightPx" | "paperTextureUrl"
>;

/**
 * Precomputed render specification for a single wave layer.
 * Contains all data needed to render a wave with parallax and oscillation.
 */
type WaveRenderSpec = {
  /** Unique React key for this wave layer */
  key: string;
  /** Z-index for layer ordering (lower = farther, higher = closer) */
  zIndex: number;
  /** Parallax multiplier (0-100) for scroll-driven horizontal movement */
  parallaxMultiplier: number;
  /** Optional additional styles for the layer wrapper view */
  wrapperStyle?: StyleProp<ViewStyle>;
  /** Props for the WaveLayerView component */
  waveProps: WaveLayerBaseProps;
};

// ============================================================================
// AnimatedWaves
// ============================================================================

/**
 * Renders the full wave stack (background grass, ocean waves, foreground grass)
 * as a single list of <Wave /> components with precomputed props and parallax.
 *
 * @param paperTextureUrl - Paper texture source (null for no texture)
 * @param scrollProgress - Shared scroll progress (0 = first item, 1 = last item)
 */
const AnimatedWaves = ({
  paperTextureUrl,
  scrollProgress,
}: AnimatedWavesProps) => {
  const { height: containerHeightPx } = useWindowDimensions();
  const { maxParallaxPx, getRequiredWidth } = useBackgroundLayout({
    parallaxMultiplier: PARALLAX_WAVES_MAX,
  });

  /**
   * Renders a single wave layer with parallax.
   * Wraps the wave content in ParallaxLayer for scroll-driven translation.
   *
   * @param spec - Render specification including key, zIndex, parallax settings, and wave props
   * @returns Animated.View with parallax and wave layer content
   */
  const renderWaveLayer = (spec: WaveRenderSpec) => {
    const layerWidth = getRequiredWidth(spec.parallaxMultiplier);

    return (
      <ParallaxLayer
        key={spec.key}
        scrollProgress={scrollProgress}
        parallaxMultiplier={spec.parallaxMultiplier}
        maxParallaxPx={maxParallaxPx}
        style={[
          {
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: layerWidth,
            zIndex: spec.zIndex,
            overflow: "visible",
          },
          spec.wrapperStyle,
        ]}
      >
        <WaveLayerView
          {...spec.waveProps}
          paperTextureUrl={paperTextureUrl}
          containerWidthPx={layerWidth}
          containerHeightPx={containerHeightPx}
        />
      </ParallaxLayer>
    );
  };

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        overflow: "visible",
      }}
    >
      {LAYER_SPECS.map(renderWaveLayer)}
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
