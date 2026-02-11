// ============================================================================
// Foreground (grass layer)
// ============================================================================
// Top static grass layer using AnimatedWaveClipped. No animation for a stable
// foreground frame.
// ============================================================================

import { View } from "react-native";
import { createColorGenerator } from "@/shared/utils";
import AnimatedWaveClipped from "./AnimatedWaveClipped";

/** Base color for grass (green). */
// const BASE_COLOR = "#159947";
// const BASE_COLOR = "#56ab91";
// const BASE_COLOR = "#3ecc00";
const BASE_COLOR = "#5c5";

/**
 * Color generator for grass shades.
 */
export const grassColor = createColorGenerator(BASE_COLOR);

/**
 * Foreground component that renders the top grass layer.
 *
 * Static wave with larger amplitude and period, positioned at the top.
 * No animation to create a stable foreground frame.
 */
const Foreground = () => {
  return (
    <>
      <View
        className="absolute inset-0"
        style={{ zIndex: 100, marginBottom: 0 }}
      >
        <AnimatedWaveClipped
          amplitude={5}
          period={400}
          fillColor={grassColor(450)}
          height={12}
          animationDuration={0}
          waveDisplacement={0}
          animationDelay={0}
        />
      </View>
      <View
        className="absolute inset-0"
        style={{ zIndex: 100, marginBottom: -10 }}
      >
        <AnimatedWaveClipped
          amplitude={10}
          period={700}
          fillColor={grassColor(400)}
          height={10}
          animationDuration={0}
          waveDisplacement={20}
          animationDelay={0}
        />
        <AnimatedWaveClipped
          amplitude={15}
          period={900}
          fillColor={grassColor(350)}
          height={8}
          animationDuration={0}
          waveDisplacement={100}
          animationDelay={0}
        />
      </View>
    </>
  );
};

export default Foreground;
