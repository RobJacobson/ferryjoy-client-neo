// ============================================================================
// Background
// ============================================================================
// Full-bleed background: blur target containing Sky and AnimatedWaves.
// Paper texture is imported once here and passed down as paperTextureUrl.
// ============================================================================

import { Sky } from "./Sky/index";
import AnimatedWaves from "./Waves/index";

// const PAPER_TEXTURE = require("assets/textures/paper-texture-4-bw.png");

const Background = () => {
  return (
    <>
      <Sky paperTextureUrl={null} />
      <AnimatedWaves paperTextureUrl={null} />
    </>
  );
};

export default Background;
