// ============================================================================
// Background (grass layer)
// ============================================================================
// Bottom static grass layer using AnimatedWave. No animation for a
// stable background frame. Layers are driven by BACKGROUND_LAYERS in config.
// ============================================================================

import { View } from "react-native";
import type { PaperTextureSource } from "../types";
import AnimatedWave from "./AnimatedWave";
import { BACKGROUND_LAYERS } from "./config";
import { grassColor } from "./Foreground";

export type BackgroundProps = {
  /** Paper texture source. When null, wave SVGs do not render texture. */
  paperTextureUrl: PaperTextureSource;
};

/**
 * Background component that renders the bottom grass layer.
 *
 * Static wave with smaller amplitude and period, positioned at the bottom.
 * No animation to create a stable background frame.
 *
 * @param props - paperTextureUrl passed to each AnimatedWave
 */
const Background = ({ paperTextureUrl }: BackgroundProps) => {
  return (
    <>
      {BACKGROUND_LAYERS.map((layer, i) => (
        <View
          key={`bg-${i}-${layer.height}-${layer.period}`}
          className="absolute inset-0"
        >
          <AnimatedWave
            paperTextureUrl={paperTextureUrl}
            amplitude={layer.amplitude}
            period={layer.period}
            fillColor={layer.fillColor ?? grassColor(layer.lightness ?? 0)}
            height={layer.height}
            animationDuration={0}
            waveDisplacement={layer.waveDisplacement}
            animationDelay={0}
          />
        </View>
      ))}
    </>
  );
};

export default Background;
