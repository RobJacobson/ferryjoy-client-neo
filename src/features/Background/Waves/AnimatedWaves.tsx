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
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { NUM_TERMINAL_CARDS } from "@/data/terminalConnections";
import { useIsLandscape } from "@/shared/hooks/useIsLandscape";
import { getMaxParallaxPx, PARALLAX_WAVES_MAX } from "../config";
import { computeRequiredBackgroundWidth } from "../parallaxWidth";
import type { BackgroundParallaxProps, PaperTextureSource } from "../types";
import { Wave } from "./AnimatedWave";
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
  const parallaxStyle = useAnimatedStyle(() => {
    if (slotWidth === 0) {
      return { transform: [{ translateX: 0 }] };
    }
    const progress = scrollX.value / slotWidth;
    const translateX = -progress * (parallaxMultiplier / 100) * maxParallaxPx;
    return { transform: [{ translateX }] };
  }, [slotWidth, parallaxMultiplier, maxParallaxPx]);

  return (
    <Animated.View
      className="absolute inset-0"
      style={[parallaxStyle, { zIndex }, wrapperStyle]}
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
  const isLandscape = useIsLandscape();
  const maxParallaxPx = getMaxParallaxPx(isLandscape);
  const wavesWidth = computeRequiredBackgroundWidth(
    slotWidth,
    NUM_TERMINAL_CARDS,
    PARALLAX_WAVES_MAX,
    maxParallaxPx
  );

  return (
    <View className="flex-1">
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
              <Wave {...waveProps} />
            </ParallaxWaveLayer>
          );
        })}
      </View>
    </View>
  );
};

export default AnimatedWaves;
