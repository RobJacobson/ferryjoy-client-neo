// ============================================================================
// Animated Waves Skia Component
// ============================================================================
// Composes Skia versions of Foreground, OceanWaves, and Background.
// ============================================================================

import type { SkImage } from "@shopify/react-native-skia";
import { ScrollView, View } from "react-native";
import BackgroundSkia from "./BackgroundSkia";
import ForegroundSkia from "./ForegroundSkia";
import OceanWavesSkia from "./OceanWavesSkia";

const containerWidth = 2000;
const marginOffset = -500;

export type AnimatedWavesSkiaProps = {
  /** Skia Image for the paper texture. */
  paperTexture?: SkImage | null;
};

/**
 * AnimatedWavesSkia component that composes Skia wave layers.
 *
 * @param props - Optional paper texture
 */
const AnimatedWavesSkia = ({ paperTexture }: AnimatedWavesSkiaProps) => {
  return (
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
            width: containerWidth,
            marginLeft: marginOffset,
            marginRight: marginOffset,
          }}
        >
          <ForegroundSkia paperTexture={paperTexture} />
          <OceanWavesSkia paperTexture={paperTexture} />
          <BackgroundSkia paperTexture={paperTexture} />
        </View>
      </ScrollView>
    </View>
  );
};

AnimatedWavesSkia.displayName = "AnimatedWavesSkia";

export default AnimatedWavesSkia;
