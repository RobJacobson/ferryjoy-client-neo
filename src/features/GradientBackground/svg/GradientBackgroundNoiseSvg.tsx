/**
 * Tiled PNG noise pattern over the gradient scene; gated by module config.
 */

import { StyleSheet } from "react-native";
import Svg, { Defs, Pattern, Rect, Image as SvgImage } from "react-native-svg";

type GradientBackgroundNoiseSvgProps = {
  width: number;
  height: number;
  svgIdPrefix: string;
};

const GRADIENT_BACKGROUND_NOISE_TEXTURE = require("../../../../assets/textures/gradient-background-noise.png");
const GRADIENT_BACKGROUND_NOISE_TEXTURE_SIZE_PX = 512;
const GRADIENT_BACKGROUND_NOISE_CONFIG = {
  enabled: true,
  opacity: 0.2,
  scale: 1,
  offsetXPx: 0,
  offsetYPx: 0,
} as const;

/**
 * Full-viewport SVG rect filled with a repeating noise texture, or `null` when
 * disabled in `GRADIENT_BACKGROUND_NOISE_CONFIG`.
 *
 * @param props - SVG dimensions
 * @param props.width - Viewport width in logical pixels
 * @param props.height - Viewport height in logical pixels
 * @returns Noise overlay SVG or nothing when disabled
 */
export const GradientBackgroundNoiseSvg = ({
  width,
  height,
  svgIdPrefix,
}: GradientBackgroundNoiseSvgProps) => {
  if (!GRADIENT_BACKGROUND_NOISE_CONFIG.enabled) {
    return null;
  }

  const patternId = `${svgIdPrefix}-gradient-background-noise`;
  const noisePatternSize =
    GRADIENT_BACKGROUND_NOISE_TEXTURE_SIZE_PX *
    GRADIENT_BACKGROUND_NOISE_CONFIG.scale;

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width={noisePatternSize}
          height={noisePatternSize}
          x={GRADIENT_BACKGROUND_NOISE_CONFIG.offsetXPx}
          y={GRADIENT_BACKGROUND_NOISE_CONFIG.offsetYPx}
        >
          <SvgImage
            href={GRADIENT_BACKGROUND_NOISE_TEXTURE}
            width={noisePatternSize}
            height={noisePatternSize}
          />
        </Pattern>
      </Defs>
      <Rect
        width="100%"
        height="100%"
        fill={`url(#${patternId})`}
        fillOpacity={GRADIENT_BACKGROUND_NOISE_CONFIG.opacity}
      />
    </Svg>
  );
};
