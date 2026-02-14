// ============================================================================
// Foreground (grass layer)
// ============================================================================
// Top static grass layer using AnimatedWave. No animation for a stable
// foreground frame. Layers are driven by FOREGROUND_LAYERS in config.
// ============================================================================

import { View } from "react-native";
import { createColorGenerator } from "@/shared/utils";
import type { PaperTextureSource } from "../types";
import AnimatedWave from "./AnimatedWave";
import { FOREGROUND_LAYERS, GRASS_BASE_COLOR } from "./config";

/**
 * Color generator for grass shades. Exported for use by Background.
 */
export const grassColor = createColorGenerator(GRASS_BASE_COLOR);

export type ForegroundProps = {
  /** Paper texture source. When null, wave SVG does not render texture. */
  paperTextureUrl: PaperTextureSource;
};

/**
 * Foreground component that renders the top grass layer.
 *
 * Static wave with larger amplitude and period, positioned at the top.
 * No animation to create a stable foreground frame.
 *
 * @param props - paperTextureUrl passed to AnimatedWave instances
 */
const Foreground = ({ paperTextureUrl }: ForegroundProps) => {
  return (
    <>
      {FOREGROUND_LAYERS.map((layer, i) => (
        <View
          key={`fg-${i}-${layer.height}-${layer.period}`}
          className="absolute inset-0"
          style={{
            zIndex: 100,
            marginBottom: i === 0 ? 0 : -10,
          }}
        >
          <AnimatedWave
            paperTextureUrl={paperTextureUrl}
            amplitude={layer.amplitude}
            period={layer.period}
            fillColor={grassColor(layer.lightness)}
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

export default Foreground;
