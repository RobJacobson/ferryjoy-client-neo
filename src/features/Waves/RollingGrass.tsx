// ============================================================================
// Rolling Grass Component
// ============================================================================
// Renders static grass layers using AnimatedWave.
// Creates top and bottom framing with no animation.
// ============================================================================

import { View } from "react-native";
import AnimatedWave from "./AnimatedWave";

/**
 * ForegroundGrass component that renders the top grass layer.
 *
 * Static wave with larger amplitude and period, positioned at the top.
 * No animation to create a stable foreground frame.
 */
const ForegroundGrass = () => {
  return (
    <View
      className="absolute inset-0"
      style={{ zIndex: 100, marginBottom: -10 }}
    >
      <AnimatedWave
        amplitude={20}
        period={800}
        fillColor="#56ab91"
        height={12}
        animationDuration={0}
        waveDisplacement={0}
        animationDelay={0}
      />
    </View>
  );
};

/**
 * BackgroundGrass component that renders the bottom grass layer.
 *
 * Static wave with smaller amplitude and period, positioned at the bottom.
 * No animation to create a stable background frame.
 */
const BackgroundGrass = () => {
  return (
    <View className="absolute inset-0" style={{ zIndex: 0 }}>
      <AnimatedWave
        amplitude={10}
        period={300}
        fillColor="#88d4ab"
        height={45}
        animationDuration={0}
        waveDisplacement={0}
        animationDelay={0}
      />
    </View>
  );
};

export { ForegroundGrass, BackgroundGrass };
