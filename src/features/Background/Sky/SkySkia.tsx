// ============================================================================
// Sky Skia
// ============================================================================
// Full-bleed sky background with linear gradient and sunburst using Skia.
// ============================================================================

import {
  Canvas,
  ImageShader,
  LinearGradient,
  Rect,
  type SkImage,
  vec,
} from "@shopify/react-native-skia";
import { View } from "react-native";
import SunburstLayoutSkia from "./SunburstLayoutSkia";

const PINK_300 = "#f9a8d4";
const PAPER_TEXTURE_OPACITY = 0.25;

export type SkySkiaProps = {
  /**
   * Skia Image for the paper texture.
   */
  paperTexture?: SkImage | null;
};

/**
 * Sky background using Skia for gradient and sunburst.
 *
 * @param props - Optional paper texture
 */
const SkySkia = ({ paperTexture }: SkySkiaProps) => {
  return (
    <View className="absolute inset-0">
      <Canvas style={{ position: "absolute", inset: 0 }}>
        {/* Background Gradient */}
        <Rect x={0} y={0} width={2000} height={2000}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(1000, 1000)} // Approximate 45 degree gradient
            colors={[PINK_300, "white"]}
          />
        </Rect>

        {/* Paper Texture Overlay */}
        {paperTexture && (
          <Rect
            x={0}
            y={0}
            width={2000}
            height={2000}
            opacity={PAPER_TEXTURE_OPACITY}
          >
            <ImageShader
              image={paperTexture}
              tx="repeat"
              ty="repeat"
              rect={{ x: 0, y: 0, width: 2000, height: 2000 }}
            />
          </Rect>
        )}
      </Canvas>

      <SunburstLayoutSkia
        paperTexture={paperTexture}
        rayCount={18}
        centerX={25}
        centerY={20}
        size={1000}
      />
    </View>
  );
};

SkySkia.displayName = "SkySkia";

export default SkySkia;
