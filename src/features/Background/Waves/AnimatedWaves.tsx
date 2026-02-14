// ============================================================================
// Animated Waves Component
// ============================================================================
// Composes three layers: Foreground, OceanWaves, and Background.
// Creates a depth effect with grass framing and animated ocean waves.
// Uses transform-based animations for optimal 60 FPS performance.
// ============================================================================

import { ScrollView, View } from "react-native";
import type { PaperTextureSource } from "../types";
import { WAVES_CONTAINER } from "./config";
import OceanWaves from "./OceanWaves";
import { Background, Foreground } from "./RollingGrass";

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
const AnimatedWaves = ({ paperTextureUrl }: AnimatedWavesProps) => (
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
            width: WAVES_CONTAINER.width,
            marginLeft: WAVES_CONTAINER.marginOffset,
            marginRight: WAVES_CONTAINER.marginOffset,
          }}
        >
          <Foreground paperTextureUrl={paperTextureUrl} />
          <OceanWaves paperTextureUrl={paperTextureUrl} />
          <Background paperTextureUrl={paperTextureUrl} />
        </View>
      </ScrollView>
    </View>
);

export default AnimatedWaves;
