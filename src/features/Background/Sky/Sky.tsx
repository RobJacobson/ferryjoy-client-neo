// ============================================================================
// Sky
// ============================================================================
// Full-bleed sky background with linear gradient (pink-300 → white at 45°),
// optional tiled paper texture overlay at 25% opacity, and a centered sunburst.
// Parallax: scroll-driven translateX using sky multiplier.
// ============================================================================

import { LinearGradient } from "expo-linear-gradient";
import { Image, View } from "react-native";
import { SKY_PARALLAX_MULTIPLIER } from "../config";
import { ParallaxLayer } from "../ParallaxLayer";
import type { PaperTextureSource } from "../types";
import { useBackgroundLayout } from "../useBackgroundLayout";
import config from "./config";
import SunburstLayout from "./SunburstLayout";

type SkyProps = {
  /**
   * Paper texture source (e.g. require() asset). When null, no texture overlay.
   */
  paperTextureUrl: PaperTextureSource;
  scrollableRange: number;
  itemStride: number;
};

/**
 * Sky background: linear gradient at 45°, optional tiled paper texture at 25%
 * opacity, and sunburst overlay. Parallax from ParallaxProvider context.
 *
 * Coordinate system:
 * - Layer starts at x=0 (left-aligned to viewport)
 * - As scrollProgress goes 0→1, layer translates LEFT
 * - translateX = -scrollProgress × parallaxDistance
 * - Layer must extend right to cover: screenWidth + parallaxDistance
 *
 * @param paperTextureUrl - Paper texture source (e.g. require() asset), null for no texture
 * @param scrollableRange - Total pixels the carousel can scroll
 * @param itemStride - One scroll step in pixels (itemSize + spacing)
 */
const Sky = ({ paperTextureUrl, scrollableRange, itemStride }: SkyProps) => {
  const { parallaxDistance, layerContainerWidth: skyWidth } =
    useBackgroundLayout({
      parallaxMultiplier: SKY_PARALLAX_MULTIPLIER,
      scrollableRange,
      itemStride,
    });

  return (
    <ParallaxLayer
      parallaxDistance={parallaxDistance}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: skyWidth,
      }}
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
    </ParallaxLayer>
  );
};

export default Sky;
