// ============================================================================
// Background
// ============================================================================
// Full-bleed background: Sky and AnimatedWaves. Parallax scroll progress from
// ParallaxProvider context. Paper texture passed down as paperTextureUrl.
// ============================================================================

import { Sky } from "./Sky/index";
import { AnimatedWaves } from "./Waves/index";

// const PAPER_TEXTURE = require("assets/textures/paper-texture-4-bw.png");

/**
 * Composes the full background by layering Sky and AnimatedWaves.
 * Both get parallax scroll progress from ParallaxProvider context.
 *
 * @returns Fragment containing Sky and AnimatedWaves background layers
 */
const Background = () => (
  <>
    <Sky paperTextureUrl={null} />
    <AnimatedWaves paperTextureUrl={null} />
  </>
);

export default Background;
