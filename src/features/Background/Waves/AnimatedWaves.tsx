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
import { MAX_PARALLAX_PX } from "../config";
import type { BackgroundParallaxProps, PaperTextureSource } from "../types";
import { Wave } from "./AnimatedWave";
import { WAVES_CONTAINER } from "./config";
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
  zIndex,
  wrapperStyle,
  children,
}: ParallaxWaveLayerProps) => {
  const parallaxStyle = useAnimatedStyle(() => {
    if (slotWidth === 0) {
      return { transform: [{ translateX: 0 }] };
    }
    const progress = scrollX.value / slotWidth;
    const translateX = -progress * (parallaxMultiplier / 100) * MAX_PARALLAX_PX;
    return { transform: [{ translateX }] };
  }, [slotWidth, parallaxMultiplier]);

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

  return (
    <View className="flex-1">
      <View
        className="relative h-full"
        style={{
          width: WAVES_CONTAINER.width,
          marginLeft: WAVES_CONTAINER.marginOffset,
          marginRight: WAVES_CONTAINER.marginOffset,
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
