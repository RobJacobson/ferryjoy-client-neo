// ============================================================================
// Background (grass layer)
// ============================================================================
// Bottom static grass layer using AnimatedWaveClipped. No animation for a
// stable background frame.
// ============================================================================

import { View } from "react-native";
import type { PaperTextureSource } from "../types";
import AnimatedWaveClipped from "./AnimatedWaveClipped";
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
 * @param props - paperTextureUrl passed to each AnimatedWaveClipped
 */
const Background = ({ paperTextureUrl }: BackgroundProps) => {
  return (
    <>
      <View className="absolute inset-0">
        <AnimatedWaveClipped
          paperTextureUrl={paperTextureUrl}
          amplitude={18}
          period={200}
          fillColor={"#DEF"}
          height={49}
          animationDuration={0}
          waveDisplacement={50}
          animationDelay={0}
        />
      </View>
      <View className="absolute inset-0">
        <AnimatedWaveClipped
          paperTextureUrl={paperTextureUrl}
          amplitude={18}
          period={300}
          fillColor={grassColor(600)}
          height={48}
          animationDuration={0}
          waveDisplacement={0}
          animationDelay={0}
        />
      </View>
      <View className="absolute inset-0">
        <AnimatedWaveClipped
          paperTextureUrl={paperTextureUrl}
          amplitude={16}
          period={450}
          fillColor={grassColor(550)}
          height={47}
          animationDuration={0}
          waveDisplacement={200}
          animationDelay={0}
        />
      </View>
      <View className="absolute inset-0">
        <AnimatedWaveClipped
          paperTextureUrl={paperTextureUrl}
          amplitude={12}
          period={450}
          fillColor={grassColor(500)}
          height={46}
          animationDuration={0}
          waveDisplacement={0}
          animationDelay={0}
        />
      </View>
      <View className="absolute inset-0">
        <AnimatedWaveClipped
          paperTextureUrl={paperTextureUrl}
          amplitude={10}
          period={400}
          fillColor={grassColor(450)}
          height={45}
          animationDuration={0}
          waveDisplacement={0}
          animationDelay={0}
        />
      </View>
      <View className="absolute inset-0">
        <AnimatedWaveClipped
          paperTextureUrl={paperTextureUrl}
          amplitude={2}
          period={300}
          fillColor={grassColor(400)}
          height={42}
          animationDuration={0}
          waveDisplacement={50}
          animationDelay={0}
        />
      </View>
    </>
  );
};

export default Background;
