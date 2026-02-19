// ============================================================================
// Animated Waves (wave stack)
// ============================================================================
// Renders a single stack of Wave layers: background grass, ocean waves, then
// foreground grass. All layers are precomputed; parallax per layer from scroll.
// ============================================================================

import { useWindowDimensions, View } from "react-native";
import { NUM_TERMINAL_CARDS } from "@/data/terminalConnections";
import { createColorGenerator, lerp } from "@/shared/utils";
import {
  PARALLAX_BG_GRASS,
  PARALLAX_FG_GRASS,
  PARALLAX_OCEAN,
  PARALLAX_WAVES_MAX,
} from "../config";
import { ParallaxLayer } from "../ParallaxLayer";
import { computeRequiredBackgroundWidth } from "../parallaxWidth";
import type { BackgroundParallaxProps, PaperTextureSource } from "../types";
import { useBackgroundLayout } from "../useBackgroundLayout";
import {
  BACKGROUND_LAYERS,
  FOREGROUND_LAYERS,
  GRASS_BASE_COLOR,
  OCEAN_WAVES,
} from "./config";
import { WaveLayerView } from "./WaveLayerView";

const OCEAN_LAYER_INDICES = Array(OCEAN_WAVES.count)
  .fill(0)
  .map((_, index) => index);

export type AnimatedWavesProps = BackgroundParallaxProps & {
  /**
   * Paper texture source. When null, wave SVGs do not render the texture overlay.
   */
  paperTextureUrl: PaperTextureSource;
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
  const { width: screenWidth, height: containerHeightPx } =
    useWindowDimensions();
  const { maxParallaxPx } = useBackgroundLayout({
    parallaxMultiplier: PARALLAX_WAVES_MAX,
  });

  const blueColor = createColorGenerator(OCEAN_WAVES.baseColor);
  const grassColor = createColorGenerator(GRASS_BASE_COLOR);

  const computePhaseOffset = (index: number): number => {
    const t = ((index * 73) % 101) / 101;
    return t * 2 * Math.PI;
  };

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
      }}
    >
      {BACKGROUND_LAYERS.map((layer, i) => {
        const t =
          BACKGROUND_LAYERS.length > 1 ? i / (BACKGROUND_LAYERS.length - 1) : 0;
        const parallaxMultiplier = Math.round(
          lerp(t, PARALLAX_BG_GRASS.min, PARALLAX_BG_GRASS.max)
        );
        const layerWidth = computeRequiredBackgroundWidth(
          screenWidth,
          NUM_TERMINAL_CARDS,
          parallaxMultiplier,
          maxParallaxPx
        );
        return (
          <ParallaxLayer
            key={`bg-${layer.height}-${layer.period}-${layer.amplitude}`}
            scrollX={scrollX}
            slotWidth={slotWidth}
            parallaxMultiplier={parallaxMultiplier}
            maxParallaxPx={maxParallaxPx}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: layerWidth,
              zIndex: i + 1,
            }}
          >
            <WaveLayerView
              amplitude={layer.amplitude}
              period={layer.period}
              fillColor={layer.fillColor ?? grassColor(layer.lightness ?? 0)}
              height={layer.height}
              waveDisplacementPx={layer.waveDisplacementPx}
              paperTextureUrl={paperTextureUrl}
              containerWidthPx={layerWidth}
              containerHeightPx={containerHeightPx}
            />
          </ParallaxLayer>
        );
      })}

      {OCEAN_LAYER_INDICES.map((index) => {
        const t = OCEAN_WAVES.count > 1 ? index / (OCEAN_WAVES.count - 1) : 0;
        const zIndex = 10 + index;
        const parallaxMultiplier = Math.round(
          lerp(t, PARALLAX_OCEAN.min, PARALLAX_OCEAN.max)
        );
        const layerWidth = computeRequiredBackgroundWidth(
          screenWidth,
          NUM_TERMINAL_CARDS,
          parallaxMultiplier,
          maxParallaxPx
        );
        return (
          <ParallaxLayer
            key={`ocean-${zIndex}`}
            scrollX={scrollX}
            slotWidth={slotWidth}
            parallaxMultiplier={parallaxMultiplier}
            maxParallaxPx={maxParallaxPx}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: layerWidth,
              zIndex,
            }}
          >
            <WaveLayerView
              amplitude={lerp(
                t,
                OCEAN_WAVES.amplitude.min,
                OCEAN_WAVES.amplitude.max
              )}
              period={lerp(t, OCEAN_WAVES.period.min, OCEAN_WAVES.period.max)}
              fillColor={blueColor(
                lerp(t, OCEAN_WAVES.lightness.min, OCEAN_WAVES.lightness.max)
              )}
              height={lerp(t, OCEAN_WAVES.height.min, OCEAN_WAVES.height.max)}
              animationDuration={lerp(
                t,
                OCEAN_WAVES.animationDuration.min,
                OCEAN_WAVES.animationDuration.max
              )}
              waveDisplacementPx={lerp(
                t,
                OCEAN_WAVES.waveDisplacementPx.min,
                OCEAN_WAVES.waveDisplacementPx.max
              )}
              phaseOffset={computePhaseOffset(index)}
              paperTextureUrl={paperTextureUrl}
              containerWidthPx={layerWidth}
              containerHeightPx={containerHeightPx}
            />
          </ParallaxLayer>
        );
      })}

      {[...FOREGROUND_LAYERS].reverse().map((layer, i) => {
        const t =
          FOREGROUND_LAYERS.length > 1 ? i / (FOREGROUND_LAYERS.length - 1) : 0;
        const zIndex = i === 0 ? 101 : 100;
        const parallaxMultiplier = Math.round(
          lerp(t, PARALLAX_FG_GRASS.min, PARALLAX_FG_GRASS.max)
        );
        const layerWidth = computeRequiredBackgroundWidth(
          screenWidth,
          NUM_TERMINAL_CARDS,
          parallaxMultiplier,
          maxParallaxPx
        );
        const wrapperStyle = { marginBottom: i === 0 ? -10 : 0 };
        return (
          <ParallaxLayer
            key={`fg-${layer.height}-${layer.period}-${layer.amplitude}`}
            scrollX={scrollX}
            slotWidth={slotWidth}
            parallaxMultiplier={parallaxMultiplier}
            maxParallaxPx={maxParallaxPx}
            style={[
              {
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: layerWidth,
                zIndex,
              },
              wrapperStyle,
            ]}
          >
            <WaveLayerView
              amplitude={layer.amplitude}
              period={layer.period}
              fillColor={grassColor(layer.lightness)}
              height={layer.height}
              waveDisplacementPx={layer.waveDisplacementPx}
              paperTextureUrl={paperTextureUrl}
              containerWidthPx={layerWidth}
              containerHeightPx={containerHeightPx}
            />
          </ParallaxLayer>
        );
      })}
    </View>
  );
};

export default AnimatedWaves;
