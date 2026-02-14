// ============================================================================
// Sky
// ============================================================================
// Full-bleed sky background with linear gradient (pink-300 → white at 45°),
// optional tiled paper texture overlay at 25% opacity, and a centered sunburst.
// ============================================================================

import { LinearGradient } from "expo-linear-gradient";
import { Image, View } from "react-native";
import type { PaperTextureSource } from "../types";
import config from "./config";
import SunburstLayout from "./SunburstLayout";

export type SkyProps = {
  /**
   * Paper texture source (e.g. require() asset). When null, no texture overlay.
   */
  paperTextureUrl: PaperTextureSource;
};

/**
 * Sky background: linear gradient at 45°, optional tiled paper texture at 25%
 * opacity, and sunburst overlay.
 *
 * @param props - paperTextureUrl for optional texture overlay
 */
const Sky = ({ paperTextureUrl }: SkyProps) => {
  return (
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
  );
};

export default Sky;
