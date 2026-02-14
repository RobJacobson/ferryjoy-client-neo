// ============================================================================
// Animated Waves Component
// ============================================================================
// Composes three layers: Foreground, OceanWaves, and Background.
// Creates a depth effect with grass framing and animated ocean waves.
// Uses transform-based animations for optimal 60 FPS performance.
// ============================================================================

import { memo } from "react";
import { ScrollView, View } from "react-native";
import type { PaperTextureSource } from "../types";
import OceanWaves from "./OceanWaves";
import { Background, Foreground } from "./RollingGrass";
import { WaveTextureReadyProvider } from "./WaveTextureReadyContext";

/** Total width of the waves container in pixels. */
const containerWidth = 2000;

/** Margin offset on left and right sides in pixels. */
const marginOffset = -500;

export type AnimatedWavesProps = {
  /**
   * Paper texture source. When null, wave SVGs do not render the texture overlay.
   */
  paperTextureUrl: PaperTextureSource;
};

/**
 * AnimatedWaves component that composes three wave layers.
 *
 * @param props - paperTextureUrl passed to Foreground, OceanWaves, Background
 */
const AnimatedWaves = memo(({ paperTextureUrl }: AnimatedWavesProps) => {
  return (
    <WaveTextureReadyProvider>
      <View className="flex-1">
        <ScrollView
          className="flex-1"
          horizontal
          contentContainerStyle={{ height: "100%" }}
          showsHorizontalScrollIndicator={false}
        >
          <View
            className="relative h-full"
            style={{
              width: containerWidth,
              marginLeft: marginOffset,
              marginRight: marginOffset,
            }}
          >
            <Foreground paperTextureUrl={paperTextureUrl} />
            <OceanWaves paperTextureUrl={paperTextureUrl} />
            <Background paperTextureUrl={paperTextureUrl} />
          </View>
        </ScrollView>
      </View>
    </WaveTextureReadyProvider>
  );
});

export default AnimatedWaves;
