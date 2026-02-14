// ============================================================================
// Background
// ============================================================================
// Full-bleed background: blur target containing Sky and AnimatedWaves.
// Paper texture is imported once here and passed down as paperTextureUrl.
// Accepts scrollX/slotWidth for scroll-driven parallax.
// ============================================================================

import { Sky } from "./Sky/index";
import type { BackgroundParallaxProps } from "./types";
import AnimatedWaves from "./Waves/index";

// const PAPER_TEXTURE = require("assets/textures/paper-texture-4-bw.png");

const Background = ({ scrollX, slotWidth }: BackgroundParallaxProps) => {
  return (
    <>
      <Sky paperTextureUrl={null} scrollX={scrollX} slotWidth={slotWidth} />
      <AnimatedWaves
        paperTextureUrl={null}
        scrollX={scrollX}
        slotWidth={slotWidth}
      />
    </>
  );
};

export default Background;
