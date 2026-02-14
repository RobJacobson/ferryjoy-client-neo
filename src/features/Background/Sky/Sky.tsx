// ============================================================================
// Sky
// ============================================================================
// Full-bleed sky background with linear gradient (pink-300 → white at 45°),
// optional tiled paper texture overlay at 25% opacity, and a centered sunburst.
// Parallax: scroll-driven translateX using sky multiplier.
// ============================================================================

import { LinearGradient } from "expo-linear-gradient";
import { Image, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { NUM_TERMINAL_CARDS } from "@/data/terminalConnections";
import { useIsLandscape } from "@/shared/hooks/useIsLandscape";
import { getMaxParallaxPxSafe, SKY_PARALLAX_MULTIPLIER } from "../config";
import { computeRequiredBackgroundWidth } from "../parallaxWidth";
import type { BackgroundParallaxProps, PaperTextureSource } from "../types";
import config from "./config";
import SunburstLayout from "./SunburstLayout";

export type SkyProps = BackgroundParallaxProps & {
  /**
   * Paper texture source (e.g. require() asset). When null, no texture overlay.
   */
  paperTextureUrl: PaperTextureSource;
};

/**
 * Sky background: linear gradient at 45°, optional tiled paper texture at 25%
 * opacity, and sunburst overlay. Parallax offset from carousel scroll.
 *
 * @param props - paperTextureUrl, scrollX, slotWidth
 */
const Sky = ({ paperTextureUrl, scrollX, slotWidth }: SkyProps) => {
  const isLandscape = useIsLandscape();
  const { width, height } = useWindowDimensions();
  const maxParallaxPx = getMaxParallaxPxSafe(isLandscape, width, height);

  const parallaxStyle = useAnimatedStyle(() => {
    if (slotWidth === 0) {
      return { transform: [{ translateX: 0 }] };
    }
    const progress = scrollX.value / slotWidth;
    const translateX =
      -progress * (SKY_PARALLAX_MULTIPLIER / 100) * maxParallaxPx;
    return { transform: [{ translateX }] };
  }, [slotWidth, maxParallaxPx]);

  const skyWidth = computeRequiredBackgroundWidth(
    slotWidth,
    NUM_TERMINAL_CARDS,
    SKY_PARALLAX_MULTIPLIER,
    maxParallaxPx
  );

  return (
    <Animated.View
      style={[
        parallaxStyle,
        {
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: skyWidth,
        },
      ]}
    >
      <View className="absolute inset-0">
        <LinearGradient
          colors={[config.gradient.start, config.gradient.end]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        />
        {paperTextureUrl != null && (
          <Image
            source={
              typeof paperTextureUrl === "string"
                ? { uri: paperTextureUrl }
                : paperTextureUrl
            }
            resizeMode="repeat"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              opacity: config.paperTextureOpacity,
            }}
          />
        )}
        <SunburstLayout
          paperTextureUrl={paperTextureUrl}
          rayCount={config.sunburst.rayCount}
          centerX={config.sunburst.centerX}
          centerY={config.sunburst.centerY}
          layoutSize={config.sunburst.defaultSize}
        />
      </View>
    </Animated.View>
  );
};

export default Sky;
