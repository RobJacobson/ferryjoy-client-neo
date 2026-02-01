// ============================================================================
// Animated Waves Component
// ============================================================================
// Composes three layers: ForegroundGrass, OceanWaves, and BackgroundGrass.
// Creates a depth effect with grass framing and animated ocean waves.
// Uses transform-based animations for optimal 60 FPS performance.
// ============================================================================

import { memo } from "react";
import { Image, ScrollView, View } from "react-native";
import OceanWaves from "./OceanWaves";
import { BackgroundGrass, ForegroundGrass } from "./RollingGrass";

/** Total width of the waves container in pixels. */
const containerWidth = 2000;

/** Margin offset on left and right sides in pixels. */
const marginOffset = -500;

/** Paper texture image for wave surface texture effect. */
const PAPER_TEXTURE = require("../../../assets/textures/paper-texture-5-bw.png");

/**
 * AnimatedWaves component that composes three wave layers.
 */
const AnimatedWaves = memo(() => {
  return (
    <View className="flex-1 bg-white">
      {/* 
          Pre-load the texture image in a hidden native Image component.
          This forces the OS to decode the image and keep it in the GPU cache.
      */}
      <Image
        source={PAPER_TEXTURE}
        style={{ width: 1, height: 1, position: "absolute", opacity: 0.01 }}
      />

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
          <ForegroundGrass />
          <OceanWaves />
          <BackgroundGrass />
        </View>
      </ScrollView>
    </View>
  );
});

export default AnimatedWaves;
