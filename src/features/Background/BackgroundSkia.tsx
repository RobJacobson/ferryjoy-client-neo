// ============================================================================
// Background Skia
// ============================================================================
// Full-bleed background using Skia components.
// Loads paper texture once and passes it down as a Skia image.
// ============================================================================

import { useImage } from "@shopify/react-native-skia";
import SkySkia from "./Sky/SkySkia";
import AnimatedWavesSkia from "./Waves/AnimatedWavesSkia";

const PAPER_TEXTURE_ASSET = require("../../../assets/textures/paper-texture-4-bw.png");

/**
 * BackgroundSkia component that uses synchronous Skia rendering.
 * Drop-in replacement for the SVG-based Background component.
 */
const BackgroundSkia = () => {
  const paperTexture = useImage(PAPER_TEXTURE_ASSET);

  return (
    <>
      <SkySkia paperTexture={paperTexture} />
      <AnimatedWavesSkia paperTexture={paperTexture} />
    </>
  );
};

BackgroundSkia.displayName = "BackgroundSkia";

export default BackgroundSkia;
