// ============================================================================
// Background
// ============================================================================
// Full-bleed background: blur target containing Sky and AnimatedWaves.
// Paper texture is imported once here and passed down as paperTextureUrl.
// Accepts scrollProgress (0-1) for scroll-driven parallax.
// ============================================================================

import { Sky } from "./Sky/index";
import type { BackgroundParallaxProps } from "./types";
import AnimatedWaves from "./Waves/index";

// const PAPER_TEXTURE = require("assets/textures/paper-texture-4-bw.png");

/**
 * Composes the full background by layering Sky and AnimatedWaves.
 * Both components receive scrollProgress for parallax effects.
 *
 * @param scrollProgress - Shared scroll progress (0 = first item, 1 = last item)
 * @returns Fragment containing Sky and AnimatedWaves background layers
 */
const Background = ({ scrollProgress }: BackgroundParallaxProps) => {
  return (
    <>
      <Sky paperTextureUrl={null} scrollProgress={scrollProgress} />
      <AnimatedWaves paperTextureUrl={null} scrollProgress={scrollProgress} />
    </>
  );
};

export default Background;
