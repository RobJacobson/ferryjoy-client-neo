// ============================================================================
// Wave Texture Pattern Component
// ============================================================================
// Defines an SVG pattern for applying paper texture to wave surfaces.
// Grayscale texture allows wave colors to show through while adding depth.
// ============================================================================

import { Defs, Pattern, Image as SvgImage } from "react-native-svg";

/** Dimensions for texture pattern. */
const PATTERN_SIZE = 512;

/** Paper texture image for wave surface texture effect. */
const PAPER_TEXTURE = require("../../../assets/textures/paper-texture-5-bw.png");

/**
 * Props for WaveTexturePattern component.
 */
export interface WaveTexturePatternProps {
  /**
   * Unique identifier for the pattern (used in fill="url(#id)").
   * Must be unique per SVG document.
   */
  id: string;
}

/**
 * WaveTexturePattern component that defines a paper texture pattern.
 *
 * Creates an SVG pattern that tiles a grayscale paper texture image.
 * The pattern can be applied to any fill using fill="url(#id)".
 * The grayscale nature allows the underlying wave colors to show through.
 */
const WaveTexturePattern = ({ id }: WaveTexturePatternProps) => {
  return (
    <Defs>
      <Pattern
        id={id}
        patternUnits="userSpaceOnUse"
        width={PATTERN_SIZE}
        height={PATTERN_SIZE}
      >
        <SvgImage
          href={PAPER_TEXTURE}
          width={PATTERN_SIZE}
          height={PATTERN_SIZE}
          preserveAspectRatio="xMidYMid slice"
        />
      </Pattern>
    </Defs>
  );
};

export default WaveTexturePattern;
