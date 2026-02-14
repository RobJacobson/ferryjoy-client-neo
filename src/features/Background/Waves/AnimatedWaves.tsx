// ============================================================================
// Animated Waves (wave stack)
// ============================================================================
// Renders a single stack of Wave layers: background grass, ocean waves, then
// foreground grass. All layers are precomputed; ocean count and lerping stay
// flexible via config.
// ============================================================================

import { View } from "react-native";
import type { PaperTextureSource } from "../types";
import { Wave } from "./AnimatedWave";
import { WAVES_CONTAINER } from "./config";
import { buildWaveStackLayers } from "./waveLayers";

export type AnimatedWavesProps = {
  /**
   * Paper texture source. When null, wave SVGs do not render the texture overlay.
   */
  paperTextureUrl: PaperTextureSource;
};

/**
 * Renders the full wave stack (background grass, ocean waves, foreground grass)
 * as a single list of <Wave /> components with precomputed props.
 */
const AnimatedWaves = ({ paperTextureUrl }: AnimatedWavesProps) => {
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
          const { key, zIndex, wrapperStyle, ...waveProps } = layer;
          return (
            <View
              key={key}
              className="absolute inset-0"
              style={[{ zIndex }, wrapperStyle]}
            >
              <Wave {...waveProps} />
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default AnimatedWaves;
