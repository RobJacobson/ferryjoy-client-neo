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
  blueColor,
  FOREGROUND_LAYERS,
  grassColor,
  OCEAN_WAVES,
} from "./config";
import { WaveLayerView, type WaveLayerViewProps } from "./WaveLayerView";

type AnimatedWavesProps = BackgroundParallaxProps & {
  /**
   * Paper texture source. When null, wave SVGs do not render the texture overlay.
   */
  paperTextureUrl: PaperTextureSource;
};

const OCEAN_PHASE_OFFSETS = Array.from(
  { length: OCEAN_WAVES.count },
  (_, index) => {
    const t = ((index * 73) % 101) / 101;
    return t * 2 * Math.PI;
  }
);

const FOREGROUND_LAYERS_REVERSED = [...FOREGROUND_LAYERS].reverse();

type WaveLayerBaseProps = Omit<
  WaveLayerViewProps,
  "containerWidthPx" | "containerHeightPx" | "paperTextureUrl"
>;

type WaveRenderSpec = {
  key: string;
  zIndex: number;
  parallaxMultiplier: number;
  wrapperStyle?: StyleProp<ViewStyle>;
  waveProps: WaveLayerBaseProps;
};

// ============================================================================
// AnimatedWaves
// ============================================================================

/**
 * Renders the full wave stack (background grass, ocean waves, foreground grass)
 * as a single list of <Wave /> components with precomputed props and parallax.
 *
 * @param props - paperTextureUrl, scrollX, slotWidth
 */
const AnimatedWaves = ({
  paperTextureUrl,
  scrollX,
  slotWidth,
}: AnimatedWavesProps) => {
  const { height: containerHeightPx } = useWindowDimensions();
  const { maxParallaxPx, getRequiredWidth } = useBackgroundLayout({
    parallaxMultiplier: PARALLAX_WAVES_MAX,
  });

  const renderWaveLayer = (spec: WaveRenderSpec) => {
    const layerWidth = getRequiredWidth(spec.parallaxMultiplier);

    return (
      <ParallaxLayer
        key={spec.key}
        scrollX={scrollX}
        slotWidth={slotWidth}
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
        fillColor: blueColor(
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
