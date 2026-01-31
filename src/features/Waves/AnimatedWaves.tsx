// ============================================================================
// Animated Waves Component
// ============================================================================
// Composes three layers: ForegroundGrass, OceanWaves, and BackgroundGrass.
// Creates a depth effect with grass framing and animated ocean waves.
// Uses transform-based animations for optimal 60 FPS performance.
// ============================================================================

import { ScrollView, View } from "react-native";
import OceanWaves from "./OceanWaves";
import { BackgroundGrass, ForegroundGrass } from "./RollingGrass";

/** Total width of the waves container in pixels. */
const containerWidth = 2000;

/** Margin offset on left and right sides in pixels. */
const marginOffset = -500;

/**
 * AnimatedWaves component that composes three wave layers.
 *
 * Renders three layers in order: ForegroundGrass (top), OceanWaves (middle),
 * and BackgroundGrass (bottom). This creates a depth effect with grass
 * framing the animated ocean waves.
 *
 * Animation uses GPU-accelerated transforms for optimal performance (60 FPS).
 */
const AnimatedWaves = () => {
  return (
    <ScrollView
      className="flex-1 bg-white"
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
        <ForegroundGrass />
        <OceanWaves />
        <BackgroundGrass />
      </View>
    </ScrollView>
  );
};

export default AnimatedWaves;
