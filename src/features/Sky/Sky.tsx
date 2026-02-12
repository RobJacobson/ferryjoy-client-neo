// ============================================================================
// Sky
// ============================================================================
// Full-bleed sky background with linear gradient (pink-300 → white at 45°),
// tiled paper texture overlay at 25% opacity, and a centered sunburst.
// ============================================================================

import { LinearGradient } from "expo-linear-gradient";
import { Image, View } from "react-native";
import SunburstLayout from "./SunburstLayout";

// ============================================================================
// Constants
// ============================================================================

/** Tailwind pink-100. */
// biome-ignore lint/correctness/noUnusedVariables: color palette for Sky/sunburst
const PINK_100 = "#fce7f3";
/** Tailwind pink-200 (gradient end). */
// biome-ignore lint/correctness/noUnusedVariables: color palette for Sky/sunburst
const PINK_200 = "#fbcfe8";
/** Tailwind pink-300 (gradient start). */
const PINK_300 = "#f9a8d4";
/** Tailwind pink-400. */
// biome-ignore lint/correctness/noUnusedVariables: color palette for Sky/sunburst
const PINK_400 = "#f472b6";
/** Tailwind pink-500. */
// biome-ignore lint/correctness/noUnusedVariables: color palette for Sky/sunburst
const PINK_500 = "#ec4899";
/** Tailwind pink-600. */
// biome-ignore lint/correctness/noUnusedVariables: color palette for Sky/sunburst
const PINK_600 = "#db2777";

const PAPER_TEXTURE_OPACITY = 0.25;
const PAPER_TEXTURE = require("assets/textures/paper-texture-4-bw.png");

/**
 * Sky background: linear gradient at 45°, tiled paper texture at 25% opacity,
 * and sunburst overlay.
 */
const Sky = () => {
  return (
    <View className="absolute inset-0">
      <LinearGradient
        colors={[PINK_300, "white"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <Image
        source={PAPER_TEXTURE}
        resizeMode="repeat"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          opacity: PAPER_TEXTURE_OPACITY,
        }}
      />
      <SunburstLayout rayCount={12} centerX={25} centerY={20} size={1000} />
    </View>
  );
};

export default Sky;
