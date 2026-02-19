// ============================================================================
// Animated Waves (wave stack)
// ============================================================================
// Renders a single stack of Wave layers: background grass, ocean waves, then
// foreground grass. All layers are precomputed; parallax per layer from scroll.
// ============================================================================

import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";
import { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated from "react-native-reanimated";
import { PARALLAX_WAVES_MAX } from "../config";
import type { BackgroundParallaxProps, PaperTextureSource } from "../types";
import { useBackgroundLayout } from "../useBackgroundLayout";
import { useParallaxScroll } from "../useParallaxScroll";
import { AnimatedWave } from "./AnimatedWave";
import { SVG_WIDTH } from "./config";
import { WaveSvg } from "./WaveSvg";
import { buildWaveStackLayers } from "./waveLayers";

export type AnimatedWavesProps = BackgroundParallaxProps & {
  /**
   * Paper texture source. When null, wave SVGs do not render the texture overlay.
   */
  paperTextureUrl: PaperTextureSource;
};

// ============================================================================
// ParallaxWaveLayer
// ============================================================================

type ParallaxWaveLayerProps = {
  scrollX: SharedValue<number>;
  slotWidth: number;
  parallaxMultiplier: number;
  maxParallaxPx: number;
  zIndex?: number;
  wrapperStyle?: ViewStyle;
  children: ReactNode;
};

/**
 * Wrapper that applies scroll-driven translateX for one wave layer.
 */
const ParallaxWaveLayer = ({
  scrollX,
  slotWidth,
  parallaxMultiplier,
  maxParallaxPx,
  zIndex,
  wrapperStyle,
  children,
}: ParallaxWaveLayerProps) => {
  const parallaxStyle = useParallaxScroll({
    scrollX,
    slotWidth,
    parallaxMultiplier,
    maxParallaxPx,
  });

  return (
    <Animated.View
      style={[
        parallaxStyle,
        {
          position: "absolute",
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          zIndex,
        },
        wrapperStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
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
  const layers = buildWaveStackLayers(paperTextureUrl);
  const { maxParallaxPx, requiredWidth: wavesWidth } = useBackgroundLayout({
    parallaxMultiplier: PARALLAX_WAVES_MAX,
  });

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <View
        className="relative h-full"
        style={{
          width: wavesWidth,
          marginLeft: 0,
          marginRight: 0,
        }}
      >
        {layers.map((layer) => {
          const {
            key,
            zIndex,
            wrapperStyle,
            parallaxMultiplier,
            ...waveProps
          } = layer;
          return (
            <ParallaxWaveLayer
              key={key}
              scrollX={scrollX}
              slotWidth={slotWidth}
              parallaxMultiplier={parallaxMultiplier}
              maxParallaxPx={maxParallaxPx}
              zIndex={zIndex}
              wrapperStyle={wrapperStyle}
            >
              {waveProps.animationDuration && waveProps.waveDisplacement ? (
                <AnimatedWave {...waveProps} />
              ) : (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                  }}
                >
                  <WaveSvg
                    {...waveProps}
                    svgRenderWidth={
                      SVG_WIDTH +
                      2 * Math.max(0, waveProps.waveDisplacement ?? 0)
                    }
                  />
                </View>
              )}
            </ParallaxWaveLayer>
          );
        })}
      </View>
    </View>
  );
};

export default AnimatedWaves;
