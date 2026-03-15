// ============================================================================
// Background
// ============================================================================
// Full-bleed background: Sky and AnimatedWaves. Parallax scroll progress from
// ParallaxProvider context. Paper texture passed down as paperTextureUrl.
// ============================================================================

import { Sky } from "./Sky/index";
import { AnimatedWaves } from "./Waves/index";
import { View } from "@/components/ui";

/**
 * Props for Background component.
 */
type BackgroundProps = {
  scrollableRange: number;
  itemStride: number;
};

// const PAPER_TEXTURE = require("assets/textures/paper-texture-4-bw.png");

/**
 * Composes the full background by layering Sky and AnimatedWaves.
 * Both get parallax scroll progress from ParallaxProvider context.
 *
 * @param scrollableRange - Total pixels the carousel can scroll
 * @param itemStride - One scroll step in pixels (itemSize + spacing)
 * @returns Fragment containing Sky and AnimatedWaves background layers
 */
const Background = ({ scrollableRange, itemStride }: BackgroundProps) => (
  <View
    style={{
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      overflow: "hidden",
    }}
  >
    <Sky
      paperTextureUrl={null}
      scrollableRange={scrollableRange}
      itemStride={itemStride}
    />
    <AnimatedWaves
      paperTextureUrl={null}
      scrollableRange={scrollableRange}
      itemStride={itemStride}
    />
  </View>
);

export default Background;
